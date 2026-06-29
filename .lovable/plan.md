## Plano — Ajustes do módulo COP (6 blocos)

Banco tratado como sagrado: apenas **uma** alteração de schema, aditiva (`ADD COLUMN observacoes_pagamento` no Bloco 5). Status `Em Oficina` legado é mantido no código. Execução bloco a bloco, com confirmação ao final de cada um.

---

### BLOCO 1 — Bug da partição de romaneio

Arquivos: `src/components/cop/RomaneioTab.tsx`, `src/lib/cop.ts`.

- Em `handleParticionar`, **remover** `numero: selected.numero` do `insert` do COP filho — a `cops_numero_seq` atribui um número novo único. O filho fica identificado por `cop_romaneio_pai_id` + `letra`.
- Criar helper em `cop.ts`: `numeroBaseCop(cop, cops)` → retorna o `numero` do registro cujo `id === (cop.cop_romaneio_pai_id ?? cop.id)`. Helper `rotuloRomaneio(cop, cops)` = `rotuloCop(numeroBase, cop.letra)`.
- Substituir as exibições de `rotuloCop(c.numero, c.letra)` em: lista esquerda do Romaneio, painel direito, `ParticionarRomaneioDialog`, geração de PDF (`romaneio-pdf.ts`) e qualquer outro ponto da aba Romaneio — passando o array `cops` para resolver o número-base.
- Validar fluxo: partição cria filho `Romaneio Completo` (letra nova) com `0001B`; origem fica `Romaneio Parcial` (`0001A` ou sem letra, conforme regra atual).

---

### BLOCO 2 — Máquina de estados Corte + novo status "Aguardando Oficina"

Arquivos: `src/lib/cop.ts`, `src/components/cop/CorteTab.tsx`, `src/components/cop/RomaneioTab.tsx`, `src/components/cop/CopConfigPanel.tsx`, `src/hooks/use-cop-color-settings.ts`.

- Em `cop.ts`: adicionar `"Aguardando Oficina"` ao tipo `CopStatus` e à `COP_STATUS_LIST` (mantém `Em Oficina` legado).
- Helper `calcularStatusCorte({ solicitacao_risco, execucao_risco, solicitacao_corte, execucao_corte })`:
  - `exec_corte` preenchido → `Aguardando Romaneio`
  - `sol_corte` (sem exec) ou `exec_risco` → `Aguardando Corte`
  - só `sol_risco` ou nada → `Aguardando Risco`
- `CorteTab.handleAtualizar`: enquanto status ∈ {Aguardando Risco/Corte/Romaneio}, recalcular via `calcularStatusCorte` em todo salvar. Se status ≥ `Aguardando Oficina`, **bloquear edição** (inputs read-only) e desabilitar Salvar. Único retorno é "Voltar para o Corte" no Romaneio (que já existe e zera campos do romaneio).
- Botão **Enviar para Romaneio** (Corte): só habilitado quando `status === "Aguardando Romaneio"` e há peças; passa a setar status `Aguardando Oficina` (não mais `Aguardando Romaneio`).
- `RomaneioTab` lista COPs com status ∈ {`Aguardando Oficina`, `Na Oficina (Costura)`, `Romaneio Parcial`, `Romaneio Completo`}. Adicionar botão **Enviar para Oficina** no painel direito quando status = `Aguardando Oficina`:
  - Validar oficina selecionada (e demais campos mínimos: nº fretes, data saída).
  - Seta status `Na Oficina (Costura)` e dispara geração do PDF (mesmo handler de imprimir hoje).
- Config COP: adicionar entrada de cor configurável para `Aguardando Oficina` (mesmo padrão dos demais status).

Cadeia final: `Aguardando Risco → Aguardando Corte → Aguardando Romaneio → Aguardando Oficina → Na Oficina (Costura) → Romaneio Parcial/Completo → Aguardando Pagamento → Finalizado`.

---

### BLOCO 3 — Aba Romaneio: PDF, painel direito (parcial), busca de peças

**3.1 — PDF (`src/lib/romaneio-pdf.ts`)**

- Reescrever a montagem da tabela: agrupar por `(modelo, cor)`; uma linha por grupo; tamanhos em colunas fixas na ordem canônica `REFACAO_TAMANHOS` (`PP|P|M|G|GG|EXG|EXXG`) + extras (alfabética, estáveis) + coluna `Total` ao final.
- Reduzir fonte (ex.: 9pt → 8pt) e padding das linhas para caber mais.
- Cabeçalho: trocar `"Romaneio · COP XXXX"` por `"Romaneio Juff - COP XXXX"`. Manter logo + 2 vias por A4 + total geral no rodapé.

**3.2 — Painel direito também trata `Romaneio Parcial**`

- Atualizar filtro do painel direito em `RomaneioTab.tsx` para incluir `Romaneio Parcial`.
- Em cada recebimento (parcial e completo), gravar `data_recebimento` no registro alterado: a origem parcial passa a também receber `data_recebimento` na hora da partição (hoje só o filho recebe). Exibir no painel direito as datas de recebimento da origem e dos filhos.

**3.3 — Busca de peças**

- Novo bloco de busca na aba Romaneio com 3 selects (Modelo, Cor, Tamanho) — opcionais e combináveis — usando as mesmas constantes do COP.
- Resultado: lista de COPs (rótulo número+letra resolvido pelo Bloco 1) com a quantidade encontrada por COP, considerando `pecas`/`pecas_recebidas` conforme aplicável. Independente da busca por número existente.

---

### BLOCO 4 — Falta por Pedido: tabela fina + histórico + título da baixa

Arquivos: `src/components/cop/FaltaPorPedidoTab.tsx`, `src/components/cop/BaixaCopDialog.tsx`.

- **4.1** Trocar os cards por uma tabela única, ordenada por `dataUrgencia` (já existe). Colunas:
`Início Estamparia | Orçamento | Modelo | Cor | PP | P | M | G | GG | EXG | EXXG | (extras) | Total Geral`
  - 1 linha por (pedido, modelo, cor). `Início Estamparia` e `Orçamento` exibidos no primeiro registro do pedido (rowspan ou repetição visual leve).
- **4.2** Clique na linha abre `Dialog` com histórico daquele pedido (`pedido.pecas_completadas_log`): data, qtd, modelo/cor/tamanho, COP de origem (quando houver) e observação.
- **4.3** `BaixaCopDialog`: aceitar prop `orcamento`. Título: `Orçamento {orcamento} — {modelo} · {cor}` (cor com badge atual).
- Botão **Dar baixa** permanece por linha; clique na linha NÃO dispara o dialog de baixa (eventos independentes; usar `stopPropagation` no botão).

---

### BLOCO 5 — Pagamento Oficinas: campo de observações

- Migração aditiva: `ALTER TABLE public.cops ADD COLUMN IF NOT EXISTS observacoes_pagamento text;`
- Atualizar `src/integrations/supabase/types.ts` (regenerar) e adicionar `observacoes_pagamento: string | null` ao tipo `Cop` em `src/lib/cop.ts`.
- Em `PagamentoOficinasTab.tsx`: adicionar `Textarea` "Observações de pagamento" no painel selecionado, em maiúsculas (padrão do sistema), persistido junto com as ações de liberar/pagar (e em botão próprio "Salvar observação").

---

### BLOCO 6 — Grid de tamanhos fixo em COP e PCP

- Criar helper compartilhado em `src/lib/cop.ts` (ou novo `src/lib/tamanhos.ts`):
  - `colunasTamanhos(extrasDetectados: string[]): string[]` → `[...REFACAO_TAMANHOS, ...extrasOrdenados]`.
- Aplicar em:
  - `RomaneioTab.tsx` — grids de peças por linha de grupo.
  - `FaltaPorPedidoTab.tsx` — `tamanhosColunas` passa a usar o helper (mantendo coluna mesmo zerada).
  - `CorteTab.tsx` (grid de edição de peças, se aplicável).
- `DisponivelTab` já está correto — usado como referência, não alterar.
- Aplicação incremental — não tocar telas que já alinham corretamente.

---

### Ordem de execução

1. B1 → 2) B2 → 3) B3 → 4) B4 → 5) B5 → 6) B6. pode seguir com todos de uma unica vez. 