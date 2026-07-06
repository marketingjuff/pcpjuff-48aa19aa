## Escopo

Tarefa 100% frontend. **Nenhuma migração SQL** será criada ou executada. A coluna `map_producoes.status` permanece intocada no banco (vira campo legado, não lido pela UI e não mais escrito).

## Arquivos alterados (apenas 2)

1. `src/lib/map.ts` — adicionar 3 helpers puros + ajustar `podeFinalizar`.
2. `src/components/map/ProgramacaoFiosTab.tsx` — cabeçalho, células, filtro, contadores, `commitProd`.

Não serão tocados: `MalhariaBlock.tsx`, `TinturariaBlock.tsx`, `NovoProdDialog.tsx`, `MapConfigPanel.tsx`, nada de PCP/COP.

## Novos helpers em `src/lib/map.ts`

```ts
export type MapStatusFio = "entregue" | "aguardando_faturamento";
export type MapStatusEtapa = "completo" | "incompleto";

export function calcStatusFio(prod: MapProducao): MapStatusFio;
// "entregue" se nota_fiscal != null/"" E data_faturamento != null/""; senão "aguardando_faturamento".

export function calcStatusMalharia(prod: MapProducao, entregas: MapEntregaMalharia[]): MapStatusEtapa;
// "completo" se sumKgEntregas(entregas) >= 0.99 * kg_solicitados; senão "incompleto".

export function calcStatusTinturaria(progs: MapProgramacaoTinturaria[], pecasRecebidasMalharia: number): MapStatusEtapa;
// "completo" se progs.length > 0
//   E toda linha tem kg_recebidos, pecas_recebidas, data_recebimento, nota_fiscal_recebimento preenchidos
//   E sumPecasProgramadas(progs) === pecasRecebidasMalharia (X === Y, exato).
// Senão "incompleto".
```

Ajuste em `podeFinalizar`: trocar `prod.status !== "entregue"` por `calcStatusFio(prod) !== "entregue"`. Resto da função inalterado.

## Alterações em `ProgramacaoFiosTab.tsx`

1. **Cabeçalho**: renomear coluna `Status` → `Fio`; adicionar `Malharia` e `Tinturaria` logo em seguida. Ajustar `<colgroup>` e `min-w` da tabela (colunas de status estreitas ~7–8% cada, só badges).
2. **Células**: 3 `Badge` seguindo padrão visual atual — `emerald` para `Entregue`/`Completo`, `amber` para `Aguardando fat.`/`Incompleto`. Usar `byProdEntregas` / `byProdProgs` já existentes; `pecasRecebidasMalharia` = `sumPecasEntregas(entregas)`.
3. **Filtro `fStatus`**: passa a filtrar por `calcStatusFio(p)` em vez de `p.status`. Renomear label visível "Status" → "Fio" se existir.
4. **Contadores topo** (`totalAguardando` / `totalEntregues`): recalcular via `calcStatusFio`.
5. **`commitProd`**: remover o bloco que faz `patch.status = "entregue"` quando `nota_fiscal` é preenchida. Nenhuma outra escrita no campo `status`.

## Confirmação de banco

- ✅ Nenhum arquivo `supabase/migrations/*` será criado.
- ✅ Nenhuma chamada `.update({ status: ... })` permanece em `map_producoes`.
- ✅ Coluna `status` continua existindo, apenas ignorada pela UI.

Aguardando aprovação para implementar.
