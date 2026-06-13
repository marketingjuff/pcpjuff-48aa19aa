## Objetivo

1. Adicionar novo status de pedido **"reaberto"** (além de `aberto` e `completo`).
2. Marcar automaticamente como `reaberto` quando um pedido finalizado for reaberto (na aba Finalizados).
3. Exibir o status do pedido com **cor** consistente em todas as abas onde ele aparece (Dashboard, Dados In, Arte, DTF, Silk, Acabamento, Expedição).

## Mudanças

### 1. `src/lib/pedidos.ts`
- `STATUS_GERAL_OPCOES = ["aberto", "completo", "reaberto"]`.
- Sem mudança nas funções de etapa: `reaberto` se comporta como `aberto` para fluxo (pedido volta a aparecer nas áreas porque `finalizado_em` é nulo).

### 2. `src/components/pcp/shared.tsx`
- Substituir o `StatusBadge` atual (apenas dois variants) por uma versão com cor por status:
  - `aberto` → azul (bg-blue-100 text-blue-800)
  - `completo` → verde (bg-emerald-100 text-emerald-800)
  - `reaberto` → âmbar/laranja (bg-amber-100 text-amber-900)
- Exportar também um helper `statusGeralColorClass(status)` para usar em `<Chip>` e células de tabela quando não couber o badge.
- Aplicar via classes diretas no Badge (`className`) usando `variant="outline"` como base para evitar conflitos com tokens.

### 3. `src/routes/_authenticated/index.tsx`
- Alterar handler de reabrir em `FinalizadosTab`:
  ```
  onReabrir={(id) => upsert.mutate({ id, finalizado_em: null, status_geral: "reaberto" })}
  ```

### 4. Substituir exibições inline de status por `<StatusBadge>` colorido
Arquivos e linhas:
- `DadosInTab.tsx` linha 395 (célula da tabela) e Chip da linha 366 — usar `<StatusBadge>`.
- `DashboardTab.tsx` linha 187 (Chip de Status no card) — trocar para `<StatusBadge>`.
- `ArteTab.tsx` linha 182, `DTFTab.tsx` linha 208, `SilkTab.tsx` linha 214, `AcabamentoTab.tsx` linha 225 — trocar `<Chip label="Status" value={p.status_geral} />` por um wrapper com label + `<StatusBadge>`.
- Filtros existentes em DashboardTab/DTF/Silk/Acabamento passam a aceitar "reaberto" automaticamente via `STATUS_GERAL_OPCOES`.

### 5. Sem migração de banco
A coluna `status_geral` é `text` livre — não há enum/constraint. Pedidos existentes continuam válidos.

## Comportamento resultante

- Reabrir um pedido da aba Finalizados o marca como `reaberto`, mantém a `entrada_pedido` original, zera `finalizado_em`, e ele reaparece em todas as áreas (incluindo Expedição, como hoje).
- Visual: badge colorido em todas as listas e cards, facilitando identificar pedidos reabertos.
- O usuário pode ainda mudar manualmente para `completo`/`aberto` na aba Dados In se quiser.