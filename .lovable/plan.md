## Ajuste de espaçamento da tabela de Prods (MAP)

Escopo único: `src/components/map/ProgramacaoFiosTab.tsx`. Zero migrations, zero lógica, apenas CSS/JSX das larguras da tabela. Vale para as duas abas (Programação e Finalizados) porque ambas renderizam a mesma tabela deste arquivo.

### 1. Trocar larguras fixas em px por percentuais no `<colgroup>`

Somam 100%:

| Coluna | Largura |
|---|---|
| Chevron | 3% |
| Prod | 8% |
| Empresa | 8% |
| Kg solicitados | 9% |
| Fornecedor | 14% |
| Data pagamento | 12% |
| Status | 11% |
| Nota fiscal | 11% |
| Data faturam. | 12% |
| Ações | 12% |

### 2. `min-w-[1050px]` na `<table>`
Mantém `table-fixed w-full`. O `overflow-x-auto` do wrapper já existe, então em telas estreitas a tabela rola horizontalmente e os inputs de data (`w-[120px]`) / NF (`w-[110px]`) não são esmagados.

### 3. Preservado
- `table-fixed`, alinhamentos atuais, larguras dos `InlineInput`, badges, botões, expandir/recolher.
- Nada além do `<colgroup>` e da classe da `<table>` é tocado.

### Fora de escopo
Qualquer outro arquivo (MalhariaBlock, TinturariaBlock, cop-saldos, PCP/COP, banco).
