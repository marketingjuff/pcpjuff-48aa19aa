## Bloco 1 — Aba Expedição: datas editáveis em "Frete Solicitado" e "Despachado"

**Migration (backend)**
- Adicionar coluna `exp_frete_solicitado_em date` na tabela `pedidos` (já existe `exp_despachado_em`).

**`src/components/pcp/ExpedicaoTab.tsx`**
- Ao marcar `Frete Solicitado = Sim`, preencher `exp_frete_solicitado_em = hoje` automaticamente (se vazio). Ao marcar "Não", limpar.
- Mesmo comportamento já existe para `Despachado` — manter.
- Substituir os textos "Despachado em: …" por um `DateInputBR` editável logo abaixo do select, tanto para `exp_frete_solicitado_em` quanto para `exp_despachado_em`, visível somente quando o item está "Sim".
- Incluir os dois campos no payload do `handleSave` / `handleFinalizar` / `marcarTudoSim` (este último também pré-preenche `exp_frete_solicitado_em`).

**Tipos**
- Adicionar `exp_frete_solicitado_em: string | null` em `src/lib/pedidos.ts` (`Pedido` + `PedidoInput`) e em `src/integrations/supabase/schema-extras.ts`. `types.ts` é auto-gerado pela migration.

## Bloco 2 — Dashboard Master: seleção múltipla + "Finalizar selecionados"

**`src/components/pcp/DashboardTab.tsx`**
- Novo estado `selectedIds: Set<string>`.
- Nova coluna `<TableHead>` à esquerda (antes de "ETAPA") com checkbox de "selecionar todos os visíveis" no header; e checkbox por linha em cada `<TableRow>` (com `onClick stopPropagation` para não acionar a seleção da linha).
- Acima da tabela, quando houver itens selecionados, mostrar barra com contagem + botão **"Finalizar selecionados"** (verde). Desabilitado quando 0.
- Ação do botão: para cada id selecionado chamar `onFinalizarMany(ids)` recebido via prop; em seguida limpa a seleção.
- Mobile (cards): adicionar pequeno checkbox no canto do `PedidoMobileCard` ou um botão de seleção — manter simples: checkbox absoluto no canto superior esquerdo.

**`src/routes/_authenticated/index.tsx`**
- Passar nova prop `onFinalizarMany` para `DashboardTab` que itera e chama `upsert.mutate({ id, finalizado_em: new Date().toISOString(), reaberto: false })` para cada id.

**Escopo / regras**
- Não filtra automaticamente "sem pendências"; o gestor escolhe quais marcar (o usuário disse "facilita a seleção dos pedidos que não têm pendências", então a seleção é manual).
- Não altera lógica de etapa/cálculo — apenas escreve `finalizado_em`.

**Sem novos arquivos.** Reaproveita `DateInputBR`, `Checkbox` (shadcn já instalado), `Button`, `upsert.mutate`.

Posso executar?