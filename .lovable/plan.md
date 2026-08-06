# SUP — aba única "Cadastro" (Fornecedores + Produtos)

Fornecedores e Produtos passam a viver numa só tela: a aba **Cadastro** do SUP. O painel esquerdo (hoje só um seletor) vira o cadastro completo de fornecedores (buscar, criar, editar, ativar/inativar) e o lado direito continua o cadastro de produtos do fornecedor selecionado. Fornecedores sai de Configurações → SUP.

Sem migração e sem mudança de banco.

## Arquivos

**1. `src/components/sup/FornecedorDialog.tsx` (novo)**
Extrai o dialog de fornecedor de `FornecedoresTab.tsx` sem alterar campos, validação, payload ou toast. Props: `open`, `onOpenChange`, `fornecedor?` (null = novo), `onSaved?(id)`. Insert usa `.select("id").single()` para devolver o id novo; se o select falhar por permissão, chama `onSaved(null)` em vez de quebrar o salvamento. Update chama `onSaved(id)`. Sem exclusão de fornecedor, sem campo novo.

**2. `src/components/sup/FornecedoresTab.tsx`**
Mantém `useSupFornecedores()` intacto (mesma queryKey, mesmo retorno — 8 arquivos importam daqui). Remove o componente `FornecedoresTab` e os imports que sobrarem sem uso. Arquivo não é renomeado.

**3. `src/components/sup/ProdutosTab.tsx`**
Só o painel esquerdo muda:
- Cabeçalho "Fornecedores" + botão **+ Novo** (teal, `h-7`) acima da busca; busca e "Mostrar inativos" ficam como estão.
- Cada linha passa de `<button>` único para um container com dois botões irmãos: corpo da linha (seleciona o fornecedor) e ícone de lápis (abre o dialog em edição). Contagem de produtos e marcação de inativo mantidas.
- Estados novos `fornDialogOpen` e `fornEdit`; ao criar, seleciona o novo fornecedor e limpa a busca; se o fornecedor selecionado for inativado e "Mostrar inativos" estiver desligado, a seleção é limpa.
- Produtos, preços, histórico, grupos, "copiar para outro fornecedor" e os hooks exportados ficam idênticos.

**4. `src/lib/permissoes.ts`**
Na entrada `sup.produtos`, muda apenas o `label` de "Produtos" para "Cadastro". `key` e `tabValue` inalterados, então ninguém perde permissão. Nenhuma outra chave mexida.

**5. `src/components/sup/SupConfigPanel.tsx`**
Remove a aba Fornecedores (trigger, conteúdo e import); ficam Departamentos e Regras e comissionados, com `defaultValue="departamentos"`.

**6. `src/routes/_authenticated/sup.tsx`**
Não tem aba "fornecedores" hoje, então este arquivo não é alterado — o rótulo da aba muda sozinho pelo catálogo de permissões.

## Detalhes técnicos

- Nenhum contrato de export muda: `useSupFornecedores`, `useSupProdutos`, `useSupFornecedorProdutos`, `useSupProdutoGrupos`, `aplicarPrecoTabela` e o componente `ProdutosTab` seguem iguais.
- Nenhum arquivo fora da lista acima é tocado (em especial `src/lib/cop-saldos.ts` e os módulos PCP/COP/MAP/KPI).
- Verificação final: typecheck sem erro novo e sem import órfão.
