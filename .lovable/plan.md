Ajustar o espaçamento da aba "Dados In" para reduzir os espaços entrelinhas e apertar o layout como um todo.

**Mudanças propostas:**
1. Reduzir o `space-y` do container principal de `space-y-6` para `space-y-3`.
2. Reduzir o padding do card de orçamento de `py-4` para `py-2`.
3. Reduzir o `gap` entre as duas colunas de `gap-6` para `gap-4`.
4. Reduzir o `gap` dos grids internos dos cards (Input do Vendedor e Input de Produção) de `gap-4` para `gap-2`.
5. Reduzir o `space-y` dentro do componente `Field` de `space-y-1.5` para `space-y-1`.
6. Reduzir as textareas de `rows={3}` para `rows={2}` em ambos os lados.
7. Remover `pt-2` dos botões de salvar.
8. Reduzir o `space-y` do `PedidoStatusInline` de `space-y-2` para `space-y-1`.

Todas as alterações ficam restritas ao arquivo `src/components/pcp/DadosInTab.tsx`.