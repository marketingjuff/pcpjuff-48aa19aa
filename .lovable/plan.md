## Plano de ajuste de layout — Card "Input do Vendedor" (Dados In)

Arquivo: `src/components/pcp/DadosInTab.tsx`

Objetivo: igualar a densidade do card "Input do Vendedor" ao card "Input de Produção" (já em 4 colunas), alterando apenas classes CSS de grid/span — sem tocar em lógica, validação ou cálculo.

### Alterações

1. **Grid do CardContent** (linha 293):
   - De: `grid gap-2 grid-cols-1 sm:grid-cols-2`
   - Para: `grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`

2. **Ajuste de spans nos campos largos**:
   - **Orçamento Comercial** (linha 295): adicionar `lg:col-span-2` ao `<Field>`
   - **Layout (PDF até 30MB)** (linha 349): alterar o wrapper `<div>` de `sm:col-span-2` para `sm:col-span-2 lg:col-span-2`
   - **Observações do vendedor** (linha 368): alterar o wrapper `<div>` de `sm:col-span-2` para `sm:col-span-2 lg:col-span-4`
   - **Linha dos botões** (linha 373): alterar o wrapper `<div>` de `sm:col-span-2` para `sm:col-span-2 lg:col-span-4`

3. **Campos restantes** (Pedido Olist, Quantas peças, Vendedor, Forma de pagamento, Nota Fiscal, Frete, Tempo de frete, UF de Entrega, Entrada do pedido, Data de Entrega, Vetorização) permanecem sem span adicional, ocupando 1 coluna cada e distribuindo-se naturalmente pelas 4 colunas do grid.

Nenhum arquivo novo será criado. Apenas ajustes de classe CSS no arquivo existente.