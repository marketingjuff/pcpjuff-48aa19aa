# SUP → Cadastro no padrão visual do Dados In (PCP)

Mudança 100% de apresentação. Nenhuma query, mutation, cálculo de preço ou fluxo de dialog muda de comportamento. Nenhuma migração de banco.

## Arquivo novo: `src/components/shared/table-styles.ts`

Cria as constantes compartilhadas de tabela compacta (copiadas dos valores do PCP, sem importar do PCP e sem tocar no arquivo do PCP): `TABLE_FONT_STYLE` (Google Sans Flex, condensed), `TABLE_WRAPPER_CLASS` (sem `hidden md:block`), `TH_CLASS`, `TD_CLASS`, `BADGE_SM_CLASS`.

## `src/components/sup/ProdutosTab.tsx` — só imports, dois `useMemo` de filtro e o JSX de layout

### Imports
Adiciona `Card/CardHeader/CardTitle/CardContent`, `Select…`, ícones `Pencil`/`FilterX` (se ainda não importados) e as constantes de `@/components/shared/table-styles`.

### Estado e filtros
- Dois novos estados locais de UI: `filtroDepto` ("todos") e `filtroSituacao` ("todos").
- Um `useMemo` novo derivando a lista de departamentos distintos dos produtos do fornecedor selecionado (sem query nova).
- Os dois filtros entram no `useMemo` de filtragem já existente (linha ~453), antes de `ordenados`. Ordenação (`useTableSort`/`SortTh`) fica intacta.

### Estrutura do `return` (substitui o `grid lg:grid-cols-[300px_1fr]` atual)

```text
<div className="space-y-3">
  1. Card de destaque (topo, largura total)
  2. grid gap-3 lg:grid-cols-[320px_1fr]
     2a. Card Fornecedores (borda esquerda teal)
     2b. Card Produtos (borda esquerda violet)
  3. Card Histórico de preço (neutro, largura total, só com produto selecionado)
  + todos os Dialog/AlertDialog/FornecedorDialog atuais, inalterados
</div>
```

1. **Card de destaque**: rótulo "Fornecedor", nome do fornecedor selecionado em tipografia grande, contagem de produtos, e as ações "Novo fornecedor", "Editar fornecedor" (só com seleção) e "Novo produto" (violet, desabilitado sem fornecedor). Os botões antigos soltos nas colunas saem daqui.

2a. **Card Fornecedores (teal)**: título + contador de registros; campo "Buscar fornecedor" com `Label` no padrão Dados In; checkbox "Mostrar inativos" como hoje; lista com as mesmas linhas/handlers (selecionar, editar, apagar), agora com wrapper arredondado, `max-h-[60vh]`, tipografia condensada e destaque teal com barra à esquerda no item selecionado. Abaixo da lista, novo bloco somente-leitura **"Dados do fornecedor"** (razão social, nome fantasia, documento, situação em badge, contato, telefone com link `tel:`, e-mail com link `mailto:`, cidade/UF, condição de pagamento, observações quando houver), usando o objeto `fornecedorSel` já existente, com botão "Editar" que reaproveita o handler atual do `FornecedorDialog`.

2b. **Card Produtos (violet)**: título "Produtos — <fornecedor>" + contador; barra de filtros em grid de 4 (Buscar, Departamento, Situação, "Limpar Filtros" com `FilterX`); a mesma tabela, mesmas colunas, mesmos `SortTh` e mesmos botões de ação, apenas com a casca nova (`TABLE_WRAPPER_CLASS`, `TH_CLASS`/`TD_CLASS`, `TABLE_FONT_STYLE`, cabeçalho `sticky top-0` dentro do mesmo container que faz o scroll) e linha selecionada destacada em violet.

3. **Card Histórico de preço**: `Card` neutro de largura total com a mesma tabela, mesmos filtros ("Mostrar anulados" e tipo) e mesmo comportamento.

## Não será tocado

`src/components/pcp/shared.tsx`, `DadosInTab.tsx`, `src/lib/sup.ts`, `FornecedorDialog.tsx`, `VariacoesConfig.tsx`, `src/components/shared/sortable.tsx`, e qualquer outro arquivo. Assinaturas de `useSupProdutos`, `useSupFornecedorProdutos`, `aplicarPrecoTabela`, `aplicarPrecoNegociado`, `useSupFornecedores` permanecem idênticas.
