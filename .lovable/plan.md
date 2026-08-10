# SUP → Cadastro: lista de fornecedores no rodapé + auto-scroll

Mudança 100% de apresentação em `src/components/sup/ProdutosTab.tsx`. Nenhuma query, mutation, filtro, cálculo ou dialog muda de comportamento. Sem migração. Nenhum outro arquivo é tocado.

## Nova ordem dos blocos no `return` (linha ~934)

```text
<div className="space-y-3" ref={topoRef}>
  1. Card de destaque (inalterado)
  2. grid gap-3 lg:grid-cols-[360px_1fr]
       2a. Card "Dados do fornecedor" (teal) — extraído do card Fornecedores
       2b. Card "Produtos" (violet) — inalterado
  3. Card "Histórico de preço" (inalterado)
  4. Card "Fornecedores" (teal, largura total) — agora TABELA
  + Dialogs/AlertDialogs/FornecedorDialog (inalterados)
</div>
```

## 2a. Card "Dados do fornecedor"

O bloco somente-leitura de hoje vira um `Card` próprio com borda esquerda teal. Título e botão "Editar" (mesmo `setFornEdit`/`setFornDialogOpen`) vão para o `CardHeader`. A grid de campos é copiada como está (razão social, fantasia, documento, badge de situação, contato, telefone `tel:`, e-mail `mailto:`, cidade/UF, condição de pagamento, observações quando houver). Sem seleção: "Selecione um fornecedor na lista abaixo."

## 4. Card "Fornecedores" — tabela de largura total

- `CardHeader`: título + `{fornecedoresFiltrados.length} registro(s)` (igual hoje).
- Filtros em linha: "Buscar fornecedor" (`w-full sm:w-72`) + checkbox "Mostrar inativos".
- Tabela na mesma casca da de produtos (`TABLE_WRAPPER_CLASS`, `max-h-[45vh] overflow-y-auto`, `TABLE_FONT_STYLE`, `thead sticky top-0`).
- Colunas com `SortTh`: Fornecedor (`nome`), Razão social, CNPJ/Doc., Contato, Telefone (sem link aqui), Cidade/UF, Cond. pagamento, Produtos (`contagem`), Situação (badge) + coluna de ações.
- Nova instância de `useTableSort` sobre `fornecedoresFiltrados`, com nomes renomeados (`fornecedoresOrdenados`, `fornSortKey`, `fornSortDir`, `fornToggle`), inicial por `nome`. O `useMemo` de `fornecedoresFiltrados` não muda.
- Linha clicável seleciona o fornecedor e destaca em teal; lápis e lixeira usam `e.stopPropagation()` com os handlers atuais.
- Vazio: "Nenhum fornecedor." em `colSpan={10}`.

## Auto-scroll

`topoRef` no div externo; `selecionarFornecedor(id)` faz `setFornId(id)`, `setSelId(null)` e `scrollIntoView({ behavior: "smooth", block: "start" })` em `setTimeout(…, 50)`. Importa `useRef`.

## Não será tocado

`table-styles.ts`, `FornecedorDialog.tsx`, `src/lib/sup.ts`, `sortable.tsx`, PCP e qualquer outro arquivo.
