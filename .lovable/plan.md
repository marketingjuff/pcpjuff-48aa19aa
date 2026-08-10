# SUP — mover "Importar XML" para dentro dos dialogs

A importação passa a existir só depois de o usuário abrir um cadastro. Nada é
gravado sem confirmação, e o aviso de CNPJ repetido nunca bloqueia.

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/sup/FornecedorDialog.tsx` | editar — faixa de importação no topo |
| `src/components/sup/ImportarXmlProdutosDialog.tsx` | editar — abertura controlada por fora |
| `src/components/sup/ProdutosTab.tsx` | editar — remover botões soltos, ligar novo fluxo |
| `src/components/sup/ImportarXmlFornecedorButton.tsx` | excluir |

Sem migração. `src/lib/nfe-xml.ts` e `src/lib/sup.ts` não são tocados.

## 1. `FornecedorDialog.tsx`

Faixa teal logo abaixo do `DialogHeader` com texto explicativo, botão
"Importar XML" (`FileUp`, `size="sm" variant="outline"`) e input file oculto.

Ao escolher o arquivo: `parseNFe` → erro vira `toast.error` e o dialog segue
aberto e intacto. Monta o emitente (razão social, fantasia, documento só
dígitos, telefone, cidade, UF, condição de pagamento derivada, observação com
nº e data da nota) e preenche o `form` interno:

- cadastro novo (`!form.id`): sobrescreve os campos vindos do XML;
- edição: preenche apenas campos vazios/nulos + `toast.success`.

Aviso de CNPJ duplicado usando `useSupFornecedores()` (assinatura intacta),
comparando só dígitos e ignorando o próprio `id`: faixa amarela dentro do
dialog, informativa. Sem `AlertDialog`, sem bloqueio, sem redirecionamento.

Input file limpo ao final; estado do aviso limpo junto do `useEffect` que já
reseta o `form`. Mutation, validação e `onSaved` inalterados.

## 2. `ImportarXmlProdutosDialog.tsx`

Props opcionais novas, retrocompatíveis: `mostrarBotao?` (default `true`),
`open?`, `onOpenChange?`. Com `mostrarBotao === false` o trigger não é
renderizado; com `open`/`onOpenChange` presentes o estado externo manda.

Ao abrir por fora sem XML carregado, o componente dispara o clique no input
file na hora; cancelar a seleção fecha via `onOpenChange(false)` sem deixar
dialog vazio. Parse, validação de emitente, montagem de linhas, tabela de
conferência e gravação permanecem idênticos.

## 3. `ProdutosTab.tsx`

- Remove `ImportarXmlFornecedorButton` do card de destaque e seu import.
- Remove `ImportarXmlProdutosDialog` da barra de filtros de Produtos.
- No `Dialog open={prodOpen}`, abaixo do `DialogHeader` e só quando `!form.id`:
  faixa violeta com "Importar XML" chamando `abrirImportacaoXml()`, que fecha
  o formulário de produto (`setProdOpen(false)`) e abre `importXmlOpen`.
- No fim do componente, `ImportarXmlProdutosDialog` com as props já existentes
  (`fornecedorSel`, `produtos`, `vinculos`, `departamentos`, `grupos`,
  `unidades`, `onImportado={invalidarTudo}`), `mostrarBotao={false}` e o par
  `open`/`onOpenChange`.

Cenário que passa a funcionar: fornecedor já cadastrado → selecionar →
"Novo produto" → "Importar XML" → itens conhecidos como "Já existe", os demais
como "Novo", cadastro em lote.
