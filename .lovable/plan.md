Fechamento do COP: Disponível, Falta por Pedido (com baixa que escreve no PCP), Pagamento Oficinas, Perdas e Dashboard. Tudo **aditivo** no banco — nenhuma coluna existente alterada/removida.

## 1) Migração (somente aditiva)

**`pedidos`**
- `pecas_completadas_log jsonb DEFAULT '[]'` — histórico de cada baixa feita pelo COP: `{ modelo, cor, tamanho, qtd, em, por, cop_id, cop_numero, cop_letra }`. **Não toca** em `observacoes_pedido`, `pecas_solicitadas` segue sendo atualizada normalmente (só `qtd_enviada`).

**`cops`**
- `conferencia jsonb DEFAULT '[]'` — por linha de peça: `{ modelo, cor, tamanho, qtd_conferida }`. Por padrão, ao "Confirmar conferência" no Romaneio, copio o que foi recebido como conferido — gestor/adm podem ajustar na aba Pagamento se precisar.
- `pagamento_liberado_em timestamptz`, `pagamento_liberado_por uuid`
- `pagamento_pago_em timestamptz`, `pagamento_pago_por uuid`
- `pagamento_status text DEFAULT 'nao_pago'` — `nao_pago | liberado | pago`
- `pagamento_valor_calculado numeric(12,2)` — snapshot do valor no momento da liberação
- `perdas jsonb DEFAULT '[]'` — registros: `{ modelo, cor, tamanho, qtd, oficina_id, etiqueta, motivo, em, por }`

**RLS (aditivo, novas policies separadas, sem mexer nas existentes)**
- `cops` continua restrito a admin (já existente). Adiciono policy de UPDATE específica para `gestor` somente nas colunas `pagamento_liberado_*` via `WITH CHECK` em função helper (ou política ampla de UPDATE para gestor, validada no client; alternativa: criar `liberar_pagamento_cop(cop_id)` SECURITY DEFINER que checa `has_role(uid,'gestor')`). **Opto pela função RPC** (`liberar_pagamento_cop`, `marcar_pagamento_cop`) — mais simples e segura.
- Permitir `SELECT` em `cops` para `gestor` (precisa enxergar para liberar).

## 2) Lógica de cálculo (cliente, derivada de `cops` + `pedidos`)

Helper `src/lib/cop-saldos.ts`:
- **Em produção** = soma de `pecas` de todos os COPs com status ≥ Aguardando Romaneio (ou seja, já foram cortados: tudo exceto `Aguardando Risco`/`Aguardando Corte`). Confirmação: o prompt diz "a partir da etapa Corte" → entendo como **após corte executado**. ⇒ critério: `execucao_corte IS NOT NULL` ou `status NOT IN ('Aguardando Risco','Aguardando Corte')`.
- **Faltantes** = soma de `(qtd − qtd_enviada)` em `pecas_solicitadas` de todos os pedidos com `status_pecas = 'incompleto'`.
- **Disponível** por (modelo, cor, tamanho) = produção − faltantes.

## 3) Aba DISPONÍVEL

Grade Modelo·Cor (linhas) × Tamanhos PP→EXXG (colunas), cores ordenadas alfabeticamente. Cada célula = saldo Disponível (negativo em vermelho).

- Filtros: "Tudo o que está faltando" (apenas linhas com algum saldo < 0) · "Por cor" (select).
- Click na célula → popup com lista dos pedidos PCP que pedem aquele M·C·T: nº orçamento, qtd total, status PCP (`calcularEtapaAtual`), status COP (resumo: quantas peças já estão em produção), faltantes do pedido.

## 4) Aba FALTA POR PEDIDO

Lista pedidos com `status_pecas='incompleto'`, agrupados por pedido, detalhados por M·C·T·qtd faltante.

- **Ordem**: data mais próxima entre `inicio_estamparia` e (se Lisa / sem estampa) `inicio_acabamento`. Lista uma "data limite" = essa data − 2 dias úteis (só exibição).
- **Botão "Dar baixa"** por linha de peça (ou em lote por pedido): popup pergunta `qtd` a abater e o COP de origem (dropdown com COPs que tenham aquela M·C·T disponível, status ≥ "Romaneio Completo" preferencialmente; permito também a partir do Corte se necessário — confirmar abaixo).
- Ao confirmar:
  1. Soma na `qtd_enviada` daquela linha em `pedidos.pecas_solicitadas` (sem ultrapassar `qtd`).
  2. Append em `pedidos.pecas_completadas_log` com snapshot (modelo, cor, tamanho, qtd, em, por, cop_id/numero/letra).
  3. Recalcula `status_pecas` (trigger `sync_status_pecas_solicitadas` já existente cuida disso).
- Botão **"Solicitar peças"** (do Dados In) **continua disponível** — só atualizamos `qtd_enviada`, nunca apagamos linhas.

Exibição no Dados In do PCP: abaixo do bloco de Observações, novo painel read-only **"Peças completadas pelo COP"** que lê `pecas_completadas_log` (data, M·C·T, qtd, COP).

## 5) Aba PAGAMENTO OFICINAS

Lista de COPs com status `Romaneio Completo` (conferido) ou `Aguardando Pagamento` em diante.

- Cálculo: `Σ (qtd_conferida × valor_por_modelo[modelo]) + (oficina.valor_frete × num_fretes)`.
- Coluna **Status pagamento**: Não pago / Liberado (por X em data) / Pago (por Y em data).
- Botão **"Liberar pagamento"** visível para `gestor`/`admin` → RPC `liberar_pagamento_cop(cop_id)` grava `pagamento_liberado_*` + snapshot do `pagamento_valor_calculado`, muda `pagamento_status='liberado'` e `status='Aguardando Pagamento'`.
- Botão **"Marcar como pago"** visível só para `admin` → RPC `marcar_pagamento_cop(cop_id, pago boolean)`; se pago → `pagamento_status='pago'`, grava `pagamento_pago_*` e muda `status='Finalizado'`. Desmarcar reverte para `liberado`.
- **Pagamento parcial**: aparece automaticamente quando o romaneio é filho de partição por letra (`cop_romaneio_pai_id IS NOT NULL` ou possui letra). Cada letra paga independentemente. Pagamento "inteiro" segue normal quando o romaneio nasceu completo.

## 6) Aba PERDAS

Formulário simples + tabela read-only:
- Adicionar: oficina (dropdown), nº da etiqueta, M·C·T, qtd, motivo (texto).
- Salvo em `cops.perdas` do COP que originou a peça? — **Não**: o prompt diz que a perda é identificada pelo nº da etiqueta. Como não temos vínculo automático etiqueta→COP, **gravo em uma nova tabela `cop_perdas`** (vinculada a `oficina_id`, com `cop_id` opcional quando o usuário souber). Isso evita inventar relacionamento. **Confirmar abaixo.**
- Não altera saldo Disponível (somente registro/relatório).

## 7) Dashboard COP

Cards:
- COPs por status (contagem).
- Peças em produção (total).
- Saldo geral (Σ disponível) e top 5 itens com saldo negativo (urgências).
- Pedidos pendentes mais urgentes (top 10 por data).

## 8) Arquivos a criar/editar

Novos:
- `src/lib/cop-saldos.ts` — helpers de produção/faltantes/saldo.
- `src/components/cop/DisponivelTab.tsx`
- `src/components/cop/FaltaPorPedidoTab.tsx`
- `src/components/cop/BaixaCopDialog.tsx` (popup de dar baixa)
- `src/components/cop/PagamentoOficinasTab.tsx`
- `src/components/cop/PerdasTab.tsx`
- `src/components/cop/DashboardCopTab.tsx`
- `src/components/pcp/PecasCompletadasPanel.tsx` (read-only no Dados In)

Editados (mínimos):
- `src/routes/_authenticated/cop.tsx` — pluga as 5 abas.
- `src/components/pcp/DadosInTab.tsx` — só inclui o painel read-only abaixo das observações.
- `src/lib/cop.ts` — adiciona tipos `CopConferencia`, `CopPerda`, campos novos.
- `src/hooks/use-cop-color-settings.ts` — cores para botões "Liberar", "Marcar pago", "Dar baixa".

## Pontos para confirmar antes de implementar

1. **Critério de "em produção"**: a partir de qual status? Minha proposta = status `NOT IN ('Aguardando Risco','Aguardando Corte')` (ou seja, após o corte ter sido enviado adiante). Alternativa: usar `execucao_corte IS NOT NULL`. Mantém ou prefere outro corte?
2. **Origem do abate (Falta por Pedido)**: posso dar baixa contra qualquer COP que tenha o M·C·T (mesmo ainda em produção), ou só contra COPs com status ≥ Romaneio Completo (peça já recebida)?
3. **Perdas**: criar **nova tabela** `cop_perdas` (mais limpo) ou guardar em `cops.perdas` de um COP escolhido pelo usuário?
4. **Conferência de quantidades**: no Romaneio (prompt 2) já confirmamos a conferência. Está ok eu inicializar `cops.conferencia` copiando `pecas_recebidas` no momento da confirmação? Gestor/ADM podem editar na aba Pagamento se houver divergência.
5. **Pagamento parcial**: a letra `A` (pai) também é paga separadamente quando houver partição, certo? (cada letra = um pagamento independente).