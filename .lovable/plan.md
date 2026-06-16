## Objetivo
Trazer 3 comportamentos do **Dashboard Master** para **todas as outras abas** (Dados In, Arte, DTF, Silk, Acabamento, Expedição, Finalizados), mantendo colunas, ordem e tamanhos de fonte intactos.

---

### 1) Alerta amarelo / vermelho nas linhas
Hoje só Master e Dados In aplicam. Regra do Master (será replicada idêntica):

- Se `embalado === "Sim"` → sem destaque.
- Se não tem `saida_juff` → sem destaque.
- Calcula `diasUteisAteHoje(saida_juff, feriados)`:
  - `≤ 0` → `bg-red-50 hover:bg-red-100/80` (atrasado)
  - `=== 1` → `bg-yellow-50 hover:bg-yellow-100/80` (vence hoje/amanhã)

Vou aplicar essa mesma função `rowBgClass(p)` nas linhas de Arte, DTF, Silk, Acabamento, Expedição e Finalizados (em Finalizados o destaque nunca aparece, pois `embalado="Sim"`, mas a função fica padronizada).

### 2) Cabeçalho padronizado (igual ao Master)
Hoje as outras abas usam `<thead className="bg-muted/50 text-xs uppercase font-bold">` com `<th>` cru → cor, altura e espaçamento diferentes do Master.

Vou trocar para o mesmo padrão do Master em todas as abas (Arte, DTF, Silk, Acabamento, Expedição, Finalizados):

- Usar `<TableHeader>` + `<TableHead>` (componente shadcn, igual ao Master) **ou** manter `<th>` aplicando exatamente as classes `TH_RAW_CLASS` já existentes em `shared.tsx` (mesma cor de texto `text-muted-foreground`, altura `h-7`, `px-1.5`, `text-[11px]`, `uppercase`, `font-bold`).
- Remover o `bg-muted/50` (o Master não usa fundo no cabeçalho) para manter o resultado visual idêntico.
- Tamanho da fonte não muda (já é `text-[11px]` em todos os lugares relevantes).

### 3) Setinhas de ordenação em TODA coluna de data e número
Regra: toda coluna de **data** e toda coluna **numérica** deve ter `ArrowUpDown` clicável (alterna asc/desc), idêntico ao comportamento do Master (`toggleSortSaida` etc.).

Colunas que ganharão setinha por aba (as que já têm ficam mantidas):

| Aba | Adicionar setinha em |
|---|---|
| **Master** | QTD, ENTRADA, ARTE LIMITE, INÍCIO EST., TÉRM. EST., ACABAMENTO, EXPED. (já tem SAÍDA JUFF, ENTREGA, DIAS) |
| **Dados In** | QTD, TEMPO FRETE, ENTRADA (já tem SAÍDA JUFF, ENTREGA) |
| **Arte** | QTD, SAÍDA JUFF, ENTREGA |
| **DTF** | QTD, DATA EXEC, SAÍDA JUFF, ENTREGA |
| **Silk** | QTD, DATA SILK, SAÍDA JUFF, ENTREGA |
| **Acabamento** | QTD, SAÍDA JUFF, ENTREGA |
| **Expedição** | (já tem SAÍDA JUFF e ENTREGA — não há outras numéricas/data) |
| **Finalizados** | QTD, SAÍDA JUFF, DATA SAÍDA, FINALIZADO EM |

Comportamento: clique alterna asc → desc → asc. Apenas uma coluna ativa por vez (igual Master). Nulos/vazios vão para o fim na ordenação asc.

---

### O que NÃO será alterado
- Tamanho de fonte (continua `text-[11px]` / `text-sm` onde já está).
- Colunas: nenhuma adicionada, removida ou reordenada.
- Lógica de dados, filtros e fluxo entre abas.
- Layout dos formulários, cards e StatCards.

---

### Detalhes técnicos (resumo de implementação)

- **`shared.tsx`**: adicionar helper `rowAlertBgClass(pedido, feriados)` (mesma regra do Master) para reuso em todas as abas. Garantir `TH_RAW_CLASS` sem `bg-muted/50` e com `font-bold` (já está).
- **Cada aba** (`ArteTab`, `DTFTab`, `SilkTab`, `AcabamentoTab`, `ExpedicaoTab`, `FinalizadosTab`):
  1. Importar `useFeriados` + `rowAlertBgClass` e aplicar no `className` do `<tr>`.
  2. Substituir `<thead className="bg-muted/50 text-xs uppercase font-bold">` + `<th>` crus pelas classes/tags padrão do Master.
  3. Introduzir estado `sortKey`/`sortDir` (igual ao padrão de `toggleSort` do Expedicao/Master) e botão `ArrowUpDown` em cada coluna de data e número listada acima; aplicar `sort` no array antes do `map`.
- **`DashboardTab`** (Master): adicionar `ArrowUpDown` + toggles nos demais campos de data/QTD listados, reusando o mesmo padrão `toggleSortX` já existente.

Arquivos a editar:
- `src/components/pcp/shared.tsx`
- `src/components/pcp/DashboardTab.tsx`
- `src/components/pcp/DadosInTab.tsx`
- `src/components/pcp/ArteTab.tsx`
- `src/components/pcp/DTFTab.tsx`
- `src/components/pcp/SilkTab.tsx`
- `src/components/pcp/AcabamentoTab.tsx`
- `src/components/pcp/ExpedicaoTab.tsx`
- `src/components/pcp/FinalizadosTab.tsx`
