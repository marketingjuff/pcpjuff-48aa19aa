# PCP / Acabamento — ajustes

Único arquivo alterado: `src/components/pcp/AcabamentoTab.tsx`.
Sem migração, sem SQL, sem alteração em nenhum outro arquivo.

## 1. Responsável pelo Acabamento independente

- Reordenar o grid do formulário para: **Responsável pelo Acabamento** → **EMBALADO?** → **Data da Embalagem** → Observações (linha inteira, como hoje).
- Remover `disabled={!form.data_saida_juff}` e o placeholder condicional do `MultiSelectPeople`; placeholder fixo "Selecione...".
- `setEmbalado`: deixar de limpar `responsavel_acabamento` (mantém a limpeza de `responsavel_conferencia`).
- `setDataSaida`: deixar de limpar `responsavel_acabamento`.
- Sem mudança em `podeFinalizar`, no envio automático para a Expedição e no `payload` do `handleSave`.

## 2. Card superior — segunda linha com 7 colunas

Grid passa a `grid gap-2 grid-cols-1 sm:grid-cols-3 lg:grid-cols-7`, nesta ordem:

1. Estampador DTF — `temDTF ? (quem_bateu_dtf ?? "—") : "N/A"`
2. Estampador Silk — `temSilk ? (quem_bateu_silk ?? "—") : "N/A"`
3. Início de Acabamento
4. Término de Acabamento
5. Saída Juff (prazo)
6. Data de Entrega — `formatDateBR(data_entrega)`
7. Tipo de Frete — `frete ?? "—"`

Todas com `ReadOnlyField`, reaproveitando `temDTF` / `temSilk` já existentes.

## 3. Dashboard — 3 colunas novas

Desktop (`SortableTh`, mesmas setinhas):

- `RESP. ACAB.` depois de `STATUS DAS PEÇAS` → `responsavel_acabamento || "—"`
- `ENTREGA` depois de `SAÍDA JUFF` → `formatDateBR(data_entrega)`, `whitespace-nowrap`
- `FRETE` como última coluna → `frete ?? "—"`

Ordenação: novas chaves `respAcab` / `entrega` / `frete` no `useSort<...>` e os três `case` no switch (`cmpText`, `cmpDate`, `cmpText`). `colSpan` do estado vazio: 11 → 14.

Mobile (`PedidoMobileCard`): chips `Resp. Acab.` após `StatusPecasChip`, `Entrega` após `Saída Juff` e `Frete` por último.

## Notas técnicas

Nenhum helper novo; tudo já importado no arquivo. Nenhuma linha de total/agrupamento na tabela. Refação, correção de etapa, `VoltarDropdown`, filtros e observações permanecem intactos.
