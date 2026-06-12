## Visão geral

Implementação dividida em 6 etapas, na ordem recomendada para minimizar risco. Cada etapa termina com banco + UI consistentes antes de seguir para a próxima.

---

## Etapa 1 — Banco de dados (migração única)

Tudo em uma só migração para evitar estados intermediários quebrados.

**Tabela `pedidos`:**
- Adicionar `forma_pagamento` (text), `nf_emitida` (boolean) — espelhado com a expedição (mesma coluna).
- Mudar uso de `frete` para passar a guardar item da lista (mesmo tipo text, sem alterar coluna).
- Adicionar colunas da Expedição (nullable):
  - `expedicao_entrou_em` (timestamptz)
  - `exp_cobranca_pagamento`, `exp_pagamento`, `exp_etiqueta`, `exp_frete_solicitado`, `exp_despachado` (boolean)
  - `exp_despachado_em` (date) — preenchido quando despachado vira true
  - `exp_observacoes` (text)
  - `finalizado_em` já existe; passa a ser preenchido APENAS quando todos os itens aplicáveis da expedição estão "sim"
- Migrar dados existentes:
  - `status_geral`: tudo vira `'aberto'` (conforme decisão)
  - Pedidos hoje em Finalizados (`finalizado_em is not null` e sem dados de expedição): voltam para Expedição (`expedicao_entrou_em = finalizado_em`, `finalizado_em = null`)
- Adicionar **constraint UNIQUE** em `pedido_olist` para impedir duplicado.

**Tabela `app_lists`:** já existe e é o padrão de listas editáveis. Inserir lista nova `frete` com itens: Carro, Transportadora, Correio, Cliente Retira.

**Roles / permissões:**
- Adicionar coluna `areas` (text[] ou jsonb) em `user_roles` para guardar checkboxes de abas permitidas. (Já existe `areas_extras` — confirmar uso ou substituir).
- Apagar enum atual e recriar com: `admin`, `gestor`, `operador`.
- Reset: manter todos os admins. Demais usuários: migrar para `operador` sem nenhuma área marcada (precisarão ser reconfigurados pelo admin).
- Adicionar função `has_area(user_id, area)` security definer.

**RLS:** atualizar políticas de `pedidos` se necessário para permitir leitura/escrita por gestor/operador conforme áreas; Expedição restrita a admin + gestor com área 'expedicao'.

---

## Etapa 2 — Input de Vendedor + Frete (BLOCO 1)

`src/components/pcp/DadosInTab.tsx`:
- Adicionar dropdown **Forma de pagamento** (lista fixa: Cartão de crédito, 50%/50%, Boleto, À vista).
- Adicionar dropdown **NF Emitida** (Sim/Não).
- Trocar **Frete** de Input texto para Select, alimentado por `useAppList("frete")`.
- Validação de duplicado: ao salvar (vendedor), consultar `pedidos` por `pedido_olist`; se existir e não for o registro atual, bloquear com toast.
- Não tornar nenhum desses novos campos obrigatório para salvar (mantém regra já decidida: só os 5 obrigatórios atuais bloqueiam).

`src/routes/_authenticated/configuracoes.tsx`:
- Adicionar gerenciamento da lista `frete` (mesmo padrão de vendedor).

---

## Etapa 3 — Regras de cálculo de datas (BLOCO 2)

`src/lib/dias-uteis.ts` / cálculo de Saída Juff em DadosInTab:
- Ajustar `saidaJuffCalc` para que a Data de Entrega NÃO conte como dia útil de frete: subtrair `tempo_frete` dias úteis a partir do dia útil anterior à entrega.
- Ajustar `tempoProducaoCalc` para que o dia da Saída Juff NÃO conte como dia útil disponível: contar dias úteis entre `entrada_pedido` e o dia útil anterior à Saída Juff.
- Campo `tempo_frete` permanece editável (mantém o atual, conforme decisão).

Validar com exemplos manuais antes de seguir.

---

## Etapa 4 — Renomeação Status + alerta Pedido Incompleto (BLOCO 3)

- Renomear label "Status geral" → "Status do pedido" em todos os componentes (DadosInTab, Dashboard, tabelas de Silk/DTF/Acabamento, Master).
- Atualizar `STATUS_GERAL_OPCOES` em `src/lib/pedidos.ts` para apenas `["aberto", "completo"]`.
- Componente `PedidoStatusInline` (e equivalentes em SilkTab/DTFTab/AcabamentoTab): se `arte_data` está preenchida (arte pronta) E `status_geral === 'aberto'`, exibir badge vermelho **"Pedido Incompleto"** ACIMA do "Aguardando etapa". Some quando virar `completo`.
- Não bloquear avanço (já não bloqueia).

---

## Etapa 5 — Aba Expedição (BLOCO 4)

`src/components/pcp/ExpedicaoTab.tsx` (novo) + registrar na tabbar entre Acabamento e Finalizados:

**Entrada do pedido na Expedição:**
- Em `AcabamentoTab`, adicionar botão **"Enviar para Expedição"** (manual, conforme decisão). Esse botão seta `expedicao_entrou_em = now()`.
- Pedidos com `expedicao_entrou_em not null` e `finalizado_em is null` ficam na Expedição.
- Esses pedidos são **filtrados fora** dos dashboards de Arte/DTF/Silk/Acabamento/Dados In (acrescentar filtro `expedicao_entrou_em is null` ou check `!p.expedicao_entrou_em && !p.finalizado_em`).

**Formulário do pedido na Expedição:**
- Cabeçalho somente leitura: Pedido, Orçamento, Frete, UF, Data de entrega, Saída Juff, Forma de pagamento, NF Emitida.
- Checklist Sim/Não condicional por `forma_pagamento`:
  - 50%/50%: Cobrança do pagamento → Pagamento → NF Emitida (espelhada com vendedor) → Etiqueta → Frete Solicitado → Despachado
  - Cartão/À vista/Boleto: NF Emitida (espelhada) → Etiqueta → Frete Solicitado → Despachado
- Cada toggle salva imediatamente (independente). NF Emitida atualiza a mesma coluna `nf_emitida` (espelho real).
- Quando `exp_despachado` vira true, gravar `exp_despachado_em = today`.
- Campo Observações da Expedição (textarea).
- Ao salvar qualquer item, verificar se TODOS os itens aplicáveis estão `true`; se sim, setar `finalizado_em = now()` (data de finalização real para o filtro de Finalizados).

**Dashboard da Expedição:**
- Colunas: Pendências | Pedido | Orçamento | UF | Saída Juff | Data da entrega | Forma de pagamento
- Pendências: lista de itens com valor `false` ou `null`, separados por vírgula, fonte pequena.
- Filtros em todas as colunas, ordenação asc/desc nas de data.
- NÃO incluir "quantidade de peças" nem "status do pedido" (exceção do item 29).

**Finalizados:**
- `finalizado_em` agora é setado pela Expedição; filtro "data personalizada" já passa a usar essa data.

---

## Etapa 6 — Permissões + Dashboards globais (BLOCOS 5 e 6)

**Permissões (`src/routes/_authenticated/configuracoes.tsx`):**
- Reescrever seção Usuários:
  - Admin: vê tudo, pode criar admins.
  - Gestor: ao criar/editar, checkboxes: Dados In Vendedor, Dados In Produção, Arte, DTF, Silk, Acabamento, **Expedição**. Não acessa Usuários.
  - Operador: mesmos checkboxes **SEM Expedição**. Não acessa Configurações.
- Roteamento/visibilidade de abas usa `useMyRoles` + checagem da nova coluna `areas`.
- Aba Expedição: só aparece para admin OU gestor com area `expedicao`.

**Dashboards globais (BLOCO 6):**
- DashboardTab (Master): adicionar filtro por **etapa**.
- Em todos os dashboards (Dados In, Arte, DTF, Silk, Acabamento, Master): adicionar colunas **Qtd peças** e **Status do pedido** — exceto Expedição.
- Cores por etapa: definir paleta no `src/lib/pedidos.ts` (ex.: Arte=índigo, DTF=teal, Silk=roxo, Acabamento=âmbar, Expedição=rosa) evitando verde/amarelo/vermelho já usados em status/alertas.
- Toda coluna de data ou número de dias ganha botão de ordenação asc/desc no cabeçalho.
- Filtro Finalizados por data personalizada: já passa a usar `finalizado_em` setado na Expedição (apenas conferir que está correto).

---

## Riscos e pontos de atenção

1. **UNIQUE em `pedido_olist`**: se houver duplicados hoje no banco, a migração falha. Vou verificar antes e, se houver, listar para você decidir (consolidar ou renomear). Posso fazer um SELECT preliminar antes de aplicar a unique.
2. **Reset de roles**: todos os não-admin perderão acesso até serem reconfigurados — você confirmou isso.
3. **Pedidos hoje em Finalizados voltando para Expedição**: chegarão com todos os checkboxes vazios; o painel ficará cheio. Sugiro um botão "marcar tudo como sim" em massa para você limpar o legado depois (posso incluir já na Etapa 5).
4. **Coluna `areas_extras` existente em `user_roles`**: vou reaproveitar essa coluna se possível, em vez de criar `areas`, para não duplicar.
5. **Cálculos de dias úteis**: vou validar com 2-3 exemplos comparando antes/depois antes de seguir, porque essa regra afeta todos os pedidos ativos.

---

## Dúvidas que ainda preciso confirmar

1. **Item 35** diz "Qtd peças e Status do pedido em todos os dashboards". O dashboard de Dados In já tem QTD. Só confirmar que devo adicionar nos demais (Arte/DTF/Silk/Acabamento/Master). OK?
2. **Cores das etapas**: posso definir a paleta ou você prefere escolher? Sugestão acima.
3. **Botão "marcar tudo sim em massa"** para limpar finalizados legados que voltarão para Expedição — incluo?
4. **`tempo_frete` editável**: mantém como está. Confirmado que a regra de "2 dias úteis vazios" é o cálculo padrão do app (que já usa `tempo_frete`), e não um valor fixo novo?
