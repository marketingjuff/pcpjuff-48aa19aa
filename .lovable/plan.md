# Refazer Perda — recuperar peças perdidas em novo COP

## Objetivo

Na aba **Perdas**, ao lado do campo *Motivo* de cada linha em **"Perdas registradas em romaneios"**, adicionar botão **Refazer perda** que abre um popup para selecionar (parcial ou totalmente) as peças perdidas daquele romaneio. Ao confirmar, cria um COP novo automaticamente com essas peças pré-selecionadas em corte, e reduz as perdas do romaneio de origem. Deve haver uma forma de **desfazer** a refação. Precisa ter um botao tb de consolidar perdas onde ao clicar é possivel selecionar os romaneios embaixo para poder consolidar as perdas num unico cop.

## Fluxo

1. Usuário clica em **Refazer perda** na linha da perda (ou no cabeçalho do romaneio agrupado).
2. Abre `RefazerPerdaDialog` mostrando todas as perdas daquele COP em grid Modelo+Cor × Tamanho, com bolinhas (mesmo padrão de `EntregaRomaneioDialog`): clique no número marca completo, lápis para parcial. Máximo por célula = `qtd perdida` restante.
3. Ao confirmar:
  - Cria novo COP com status inicial (Aguardando Risco/Corte, como um COP novo padrão), com as peças selecionadas já inseridas no corte.
  - Campo observação preenchido com: `"REFAÇÃO DE PERDA - COP {numero-origem}"`.
  - Registra vínculo `refacao_perda_origem_id` no COP novo.
  - Registra os itens refeitos em `refacao_perda_itens` (jsonb) no COP novo para permitir desfazer.
  - Subtrai as quantidades refeitas de `cops.perdas` no COP de origem.
4. Nova seção **"Refações de perda"** na aba Perdas lista os COPs criados por refação, com botão **Desfazer** disponível enquanto o COP filho ainda não foi cortado/confirmado (status inicial). Desfazer: soma os itens de volta em `cops.perdas` do COP origem e deleta o COP filho.

## Regras

- Refação é informativa/produtiva; não altera cálculo de pagamento do COP origem.
- Admin e gestor com área COP podem refazer/desfazer. Operador não vê os botões.
- Não é possível selecionar mais peças do que ainda restam como perda (após refações anteriores).
- Desfazer só é permitido enquanto o COP filho está em estado inicial (sem romaneio/corte confirmado); depois disso o botão fica oculto.

## Detalhes técnicos

**DB migration (`cops`):**

- `refacao_perda_origem_id uuid REFERENCES public.cops(id) ON DELETE SET NULL`
- `refacao_perda_itens jsonb NOT NULL DEFAULT '[]'::jsonb` (array de `{modelo,cor,tamanho,qtd}`)
- Index em `refacao_perda_origem_id`.

`**src/lib/cop.ts`:**

- Helpers `subtrairPerdas(perdas, itens)` e `somarPerdas(perdas, itens)` que operam sobre o array `CopPerdaLinha[]` preservando `motivo` e removendo linhas zeradas.
- Helper `perdasRestantes(cop)` = `perdas - refações já feitas por filhos`.

**Novo componente `src/components/cop/RefazerPerdaDialog.tsx`:**

- Baseado em `EntregaRomaneioDialog` (grid de bolinhas Modelo+Cor × Tamanho).
- Props: `copOrigem`, perdas restantes, `onConfirm(itens)`.

`**src/components/cop/PerdasTab.tsx`:**

- Agrupa `perdasRomaneios` por COP para mostrar botão **Refazer perda** por romaneio (mais prático que por linha, pois o dialog já mostra todas).
- Nova seção **Refações de perda** consultando `cops` com `refacao_perda_origem_id not null`, mostrando COP origem, COP filho, itens, status, e botão **Desfazer** condicional.

**Mutations (client-side, transacionais via sequência):**

- `refazerPerda`: `insert cops` novo → `update cops` origem (perdas atualizadas). Se falhar o update, deleta o COP recém-criado.
- `desfazerRefacao`: `update cops` origem (soma volta) → `delete cops` filho.

## Fora de escopo

- Não mexe em `cop_perdas` (perdas manuais).
- Não altera PDF do romaneio nem cálculo de pagamento.
- Não permite editar peças de um COP-refação depois de criado (fluxo normal do COP a partir daí).