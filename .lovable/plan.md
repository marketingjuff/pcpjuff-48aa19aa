## Ajuste fino da tabela MAP — apenas `ProgramacaoFiosTab.tsx`

Escopo 100% visual. Zero migrations. Nenhum outro arquivo alterado.

### 1. Layout fixo com `<colgroup>`
Adicionar `table-fixed w-full` na `<table>` e inserir um `<colgroup>` com larguras explícitas para garantir que todos os grupos fiquem idênticos:

| Col | Largura |
|---|---|
| Chevron | 32px |
| Prod | 90px |
| Empresa | 90px |
| Kg solicitados | 110px |
| Fornecedor | `auto` (flexível) |
| Data pagamento | 130px |
| Status | 130px |
| Nota fiscal | 120px |
| Data faturam. | 130px |
| Ações | 150px |

### 2. Alinhamentos
- `<th>` e `<td>` centralizados (`text-center`) em: Empresa, Kg solicitados, Fornecedor, Data pagamento, Status, Nota fiscal, Data faturam.
- Prod: `text-left` (th + td).
- Ações: `text-right` (mantém).
- Padding uniforme `p-1.5` em todos.
- `whitespace-nowrap` em todos os `<th>` para garantir cabeçalhos em linha única.

### 3. Inputs uniformes
- Envolver cada `InlineInput` de data/NF em um wrapper `flex justify-center` na `<td>`, aplicando largura fixa via classe (datas ~120px, NF ~110px) através da prop `className` do InlineInput — sem tocar no componente.
- Badge de Status já centraliza com `text-center` da célula; envolver em `inline-flex justify-center` se necessário.

### 4. Cabeçalho
- Renomear "Data de faturamento" → "Data faturam.".

### Fora de escopo
Qualquer arquivo que não seja `src/components/map/ProgramacaoFiosTab.tsx`. Sem mudanças em lógica, dados, filtros ou ordenação.
