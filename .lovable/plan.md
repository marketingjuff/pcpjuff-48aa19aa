# SUP — Importar XML da NF-e (fornecedor e produtos)

Dois pontos de entrada independentes na aba **Cadastro** do SUP. Nada é gravado
sem conferência e confirmação do usuário.

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/migrations/<ts>_sup_cod_fornecedor.sql` | criar — só `ADD COLUMN IF NOT EXISTS cod_fornecedor text` + índice `(fornecedor_id, cod_fornecedor)` |
| `src/lib/nfe-xml.ts` | criar — parser puro |
| `src/components/sup/ImportarXmlFornecedorButton.tsx` | criar |
| `src/components/sup/ImportarXmlProdutosDialog.tsx` | criar |
| `src/lib/sup.ts` | editar — acrescentar `cod_fornecedor?: string \| null` em `SupFornecedorProduto` |
| `src/components/sup/ProdutosTab.tsx` | editar — inserir apenas os dois botões |

Nenhum outro arquivo é tocado. Sem dependência npm nova.

## 1. `src/lib/nfe-xml.ts`

Sem React, sem Supabase. `DOMParser` nativo, busca por nome local a partir de
`infNFe`; aceita raiz `nfeProc` ou `NFe`; erro amigável para XML inválido ou
que não seja NF-e.

Exports: `parseNFe(xmlText)` retornando `{ emitente, nota, itens }` com os tipos
`NFeEmitente`, `NFeItem`, `NFeNota`, `NFeParsed` exatamente como especificado;
`mapearUnidadeNFe(uCom, unidades)`, `condicaoPagamentoNFe`, `cfopEhCompra`,
`rotuloCfop`, `normalizarNome`.

`mapearUnidadeNFe` aplica o de-para e depois confere o resultado contra a lista
`unidades` recebida (a configurada em `app_lists`); se não estiver lá, retorna `""`.


Regras: CNPJ/CPF só dígitos; números com fallback 0 (`vDesc` → null); `chave` do
atributo `Id` sem prefixo `NFe`; `emissao` = 10 primeiros de `dhEmi`/`dEmi`;
`vencimentos` de todos os `<dup><dVenc>` (lista vazia é normal).
`condicaoPagamentoNFe` nunca inventa valor fora de `SUP_CONDICOES_PAGAMENTO`.

## 2. `ImportarXmlFornecedorButton.tsx`

Botão "Importar XML" (`FileUp`, `size="sm" variant="outline"`) + input file oculto.
Props: `fornecedores`, `onSelecionarFornecedor`.

Fluxo: parse → procura por CNPJ, depois por nome normalizado.
- Achou por CNPJ → AlertDialog "Fornecedor já cadastrado" com "Abrir cadastro".
- Achou só por nome → AlertDialog com "Vincular ao existente" (mescla só campos
  vazios, mantém o `id` → update) ou "Criar novo".
- Não achou → abre `FornecedorDialog` sem `id`, pré-preenchido (razão social,
  fantasia, CNPJ, telefone, cidade, UF, condição de pagamento derivada,
  observação com nº e data da nota).

`FornecedorDialog` é usado como está, sem alterações. Input file limpo no fim.

## 3. `ImportarXmlProdutosDialog.tsx`

Props: `fornecedor`, `produtos`, `vinculos`, `departamentos: SupDepartamento[]`,
`grupos`, `unidades: string[]`, `onImportado`.

Botão desabilitado sem fornecedor selecionado.

- Validação do emitente: CNPJ bate → segue; fornecedor sem CNPJ → aviso amarelo;
  CNPJ diferente → bloqueia com AlertDialog nomeando os dois.
- Linhas: agrupa itens com mesmo `cProd` + descrição normalizada + `vUnCom`
  (soma quantidade, "(N linhas da nota)"). `marcado` = `cfopEhCompra`.
  Casamento: `cod_fornecedor` → nome normalizado → `novo`.
- Tabela de conferência com as constantes de `shared/table-styles`; colunas
  ☑, Status, Cód. NF, Descrição na nota, Produto (input ou combobox "trocar"),
  Unidade (Select com a lista `unidades`), Departamento (Select filtrando
  `d.ativo`, `key={d.id}`, `value={d.nome}`, igual à linha 1411 do ProdutosTab),
  Grupo, Qtd, Preço NF, Preço atual (com variação %), CFOP.

  Resumo da nota, contadores, faixa amarela para CFOP fora de compra,
  "Marcar/Desmarcar todos".
- Importação sequencial, após AlertDialog de confirmação:
  - `novo`: valida nome/unidade e duplicidade no fornecedor → insert em
    `sup_produtos` → insert do vínculo com `cod_fornecedor` → `aplicarPrecoTabela`
    (inicial) se preço > 0.
  - `existe`: grava `cod_fornecedor` se vazio; preço diferente →
    `aplicarPrecoTabela`. Nunca sobrescreve nome/unidade/departamento/grupo.
  - `motivo` = `NF-e nº X — DD/MM/AAAA`. Erros por linha vão para toast, sem
    abortar as demais. Ao final `onImportado()` e fecha.

## 4. `ProdutosTab.tsx`

- `ImportarXmlFornecedorButton` no cabeçalho do card **Fornecedores**, ao lado da
  busca; `onSelecionarFornecedor` = `selecionarFornecedor` (já faz o scroll ao topo).
- `ImportarXmlProdutosDialog` na barra de filtros do card **Produtos**, ao lado da
  busca; `onImportado` = `invalidarTudo()`.
- Props vêm dos hooks já existentes; nenhuma query nova.
