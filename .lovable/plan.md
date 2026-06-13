# Rótulos dinâmicos: Salvar (novo) vs Atualizar (existente)

## Problema
Na aba **Dados In**, quando o usuário está editando um pedido já existente (com `selected` definido), o botão ainda exibe "Salvar Input do Vendedor". Isso confunde — parece que está criando um novo pedido, e se o `pedido_olist` colidir (ex.: usuário clicou em "Novo" sem perceber), o backend devolve `duplicate key value violates unique constraint "pedidos_pedido_olist_unique"`.

A regra desejada:
- **Pedido novo** (nenhum `selected`, primeira vez preenchendo) → botão "Salvar Input do Vendedor / Produção / etc."
- **Pedido aberto/em edição** (`selected` definido) → botão "Atualizar Input do Vendedor / Produção / etc."

Isso vale para **todas as abas** (Dados In, Arte, DTF, Silk, Acabamento, Expedição).

## Mudanças

### 1. `src/components/pcp/DadosInTab.tsx`
- Linha ~302: rótulo do botão "Salvar Input do Vendedor" passa a depender de `selected?.id`:
  - sem `selected` → `Salvar Input do Vendedor`
  - com `selected` → `Atualizar Input do Vendedor`
- Linha ~344: mesma lógica para "Salvar Input de Produção" → `Atualizar Input de Produção` quando há `selected`.
- O ícone (`Save`) continua o mesmo nos dois estados (já é genérico de "gravar").

### 2. Demais abas (sempre operam sobre `selected`)
Como `Arte`, `DTF`, `Silk`, `Acabamento` e `Expedição` só renderizam o formulário quando há pedido selecionado, o botão sempre será de atualização. Renomear o rótulo:
- `src/components/pcp/ArteTab.tsx` (linha 162): `Salvar` → `Atualizar Arte`
- `src/components/pcp/DTFTab.tsx` (linha 162): `Salvar` → `Atualizar DTF`
- `src/components/pcp/SilkTab.tsx` (linha 170): `Salvar` → `Atualizar Silk`
- `src/components/pcp/AcabamentoTab.tsx` (linha 186): `Salvar` → `Atualizar Acabamento`
- `src/components/pcp/ExpedicaoTab.tsx` (linha 206): `Salvar` → `Atualizar Expedição` (mantém o banner "Ao salvar, este pedido será finalizado" — só o rótulo muda)

### 3. Nada muda na lógica de gravação
O backend já faz `update` quando `row.id` existe e `insert` quando não existe (em `src/routes/_authenticated/index.tsx`, mutation `upsert`). A checagem de duplicado em `DadosInTab` já ignora o próprio `selected.id`. O erro do print acontece quando o usuário está em modo "Novo" e digita um `pedido_olist` existente — comportamento correto e protegido pela checagem.

## Fora de escopo
- Não alterar a lógica de detecção de duplicado nem o fluxo "Novo".
- Não mexer no botão "Cancelar edição" nem em "Novo / Deletar" do cabeçalho.
- Sem mudanças no schema ou em mutations.
