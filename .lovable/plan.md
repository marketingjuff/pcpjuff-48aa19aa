Dois ajustes na aba **Expedição** em `src/components/pcp/ExpedicaoTab.tsx`. Sem novos arquivos, sem mudança de lógica de dados.

## 1. Seleção de pedidos no Dashboard

**Bug atual:** o `<td>` (e o wrapper no mobile) tem `onClick={toggleId}` e o `<Checkbox>` dentro dele tem `onCheckedChange={toggleId}`. Os dois disparam no mesmo clique, cancelando a marcação.

**Correção:**
- Remover o `onClick` do `<td>`/wrapper mobile; manter apenas `e.stopPropagation()` para não abrir o card de edição. A marcação fica só no `onCheckedChange` do `Checkbox`.
- Cabeçalho: trocar o `checked` por um estado de 3 valores (`true` / `false` / `"indeterminate"`):
  - todos marcados → `true`
  - alguns marcados → `"indeterminate"`
  - nenhum → `false`
  
  O componente `Checkbox` (Radix) já suporta `checked="indeterminate"` visualmente (traço).
- "Finalizar selecionados" continua usando `selectedIds` — já funciona em individuais ou todos.

## 2. Reorganizar bloco de preenchimento da Expedição

Bloco somente-leitura (Pedido/Orçamento/Frete/UF/Data entrega/Saída Juff/Forma de pagamento/NF) **permanece igual**.

Substituir o grid único atual dos campos editáveis por duas linhas dedicadas (renderizadas só com os itens aplicáveis a `itensParaForma(...)`):

- **Linha 1 — status simples** (`grid-cols-1 sm:grid-cols-3`): Cobrança do pagamento · Pagamento · Etiqueta  
  (Cobrança/Pagamento aparecem só quando forma = "50%/50%", igual hoje.)
- **Linha 2 — status com data em pares** (`grid-cols-1 sm:grid-cols-2`, cada célula com sub-grid `grid-cols-2` para status + data colados):
  - Frete Solicitado + Frete solicitado em
  - Despachado + Despachado em
  
  A data sempre aparece (não fica mais condicionada a `=== true`), permitindo edição quando "Sim". Mantém-se a regra atual: ao alternar para "Não", `toggleItem` limpa a data (`null`). Ao mudar para "Sim", auto-preenche hoje se vazio. Nenhuma mudança em `toggleItem`, `handleSave`, `handleFinalizar`, `marcarTudoSim`.

Observações da Expedição + `ObservacoesOutrosSetores` continuam abaixo, como hoje.

### Detalhes técnicos
- Arquivo único: `src/components/pcp/ExpedicaoTab.tsx`.
- Sem mudanças em tipos, migrations, outros componentes, validação ou cálculos.
- Reaproveita `FormField`, `Select`, `DateInputBR`, `Checkbox` já importados.
