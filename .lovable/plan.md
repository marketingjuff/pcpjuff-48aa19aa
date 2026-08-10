# SUP — corrigir "aplicar em massa" na conferência da NF-e

Arquivo único: `src/components/sup/ImportarXmlProdutosDialog.tsx`. Sem migração,
sem dependência nova.

## 1. Campo vago no cadastro

Novo helper `produtoCadastradoDe(l)` e duas funções puras:

- `podeDefinirDepartamento(l)` → linha `novo`, ou `existe` com cadastro sem `departamento`;
- `podeDefinirGrupo(l)` → mesma regra para `grupo_id`.

`montarLinhas` passa a nascer com `departamento: prod?.departamento ?? ""` e
`grupo_id: prod?.grupo_id ?? ""`, então a coluna mostra o valor real do cadastro
em vez de "—".

## 2. `aplicarEmMassa` com regra por campo e toast

Guard `campo !== "unidade" && l.status === "existe"` sai. Entra elegibilidade por
campo (unidade continua livre em toda linha marcada). A função conta aplicadas,
bloqueadas e já-preenchidas e sempre termina em toast:

- aplicou N → `toast.success("Preenchido em N linha(s).")`
- aplicou N e ignorou M por cadastro → acrescenta "M ignorada(s): já definido no cadastro."
- nenhuma → `toast.warning` com o motivo predominante: "Nenhuma linha marcada.",
  "As linhas marcadas já têm este campo definido no cadastro." ou
  "As linhas marcadas já estão preenchidas."

## 3. Select de massa aplica ao escolher

`onValueChange` guarda o valor **e** chama `aplicarEmMassa(campo, valor, true)`
(só vazias). O botão "Preencher vazias" é removido; fica só "Aplicar em todas",
com `title`: "Sobrescreve o valor em todas as linhas marcadas que a importação
pode alterar." Reescolher o mesmo valor reaplica (o Select mantém o estado, a
aplicação é disparada de novo).

## 4. Selects da tabela

Departamento e grupo: `disabled` só quando o cadastro já tem valor; nesse caso o
select exibe o valor atual e recebe `title` "Já definido no cadastro — a
importação não altera."

## 5. Gravação

No ramo `existe` do `importar()`, além do que já é feito, um `update` em
`sup_produtos` apenas com `departamento` e/ou `grupo_id` — somente os campos que
estavam vagos no cadastro e agora têm valor na linha. Nome, unidade e demais
campos intocados. Preço continua exclusivamente via `aplicarPrecoTabela`;
casamento por `cod_fornecedor`, filtro de CFOP e bloqueio por unidade faltando
permanecem como estão.
