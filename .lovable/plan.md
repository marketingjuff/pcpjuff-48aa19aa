
# Auditoria e histórico de pedidos

## Objetivo

Nunca mais perder o rastro de um pedido. Toda **criação, alteração e deleção** de um pedido passa a ser gravada automaticamente, com **quem fez, quando, e o que mudou**. No card do pedido aparece um botão **"Histórico"** que abre uma linha do tempo legível.

## O que você vai ganhar

- Se alguém deletar e recriar um pedido, o log da deleção fica registrado (com quem foi).
- Se um pedido "voltar" de etapa (ex.: Dados IN → Estamparia → Dados IN), cada troca aparece na linha do tempo com autor e data.
- Se um campo importante mudar (data de entrega, quantidade, vendedor, layout, status), aparece "Fulano mudou X de A para B em DD/MM HH:MM".
- Funciona para tudo que já existe: nenhum código de mutação precisa ser alterado, porque a captura é feita no próprio banco via trigger.

## Escopo (o que entra e o que fica de fora)

**Entra agora:**
- Tabela `pedidos` (todas as 80 colunas).
- Registro de INSERT, UPDATE e DELETE.
- Painel "Histórico" no card do pedido (aba **Dados IN** ou como botão no topo do card).

**Fica de fora (por enquanto):**
- Tabelas MAP (`map_producoes`, `map_estoque_pecas` etc.) e COP (`cops`, `oficinas`, `pagamentos_consolidados`). Se quiser depois, é uma expansão barata — mesmo padrão de trigger.

## Como funciona (parte técnica)

### 1. Nova tabela `public.pedido_audit_log`

Colunas:
- `pedido_id uuid` (não é FK — precisa sobreviver a DELETE do pedido)
- `orcamento text`, `pedido_olist text` (snapshot legível mesmo se o pedido for deletado)
- `acao text` — `insert`, `update`, `delete`
- `mudancas jsonb` — array `[{ campo, de, para }]` (só campos que realmente mudaram; ignora `updated_at`)
- `linha_completa jsonb` — snapshot da linha inteira (para deletes e primeira criação)
- `feito_por uuid` (auth.uid()) + `feito_por_email text` (join com profiles no momento do log)
- `feito_em timestamptz default now()`

RLS: leitura só para quem tem `has_role(admin)` ou está autenticado com acesso PCP (mesmo critério que já entra em pedidos hoje). Sem insert/update/delete via API — só o trigger escreve.

### 2. Trigger `AFTER INSERT/UPDATE/DELETE ON public.pedidos`

Função SECURITY DEFINER que:
- Em INSERT: grava `acao='insert'` + snapshot inicial.
- Em UPDATE: diffs coluna a coluna (ignorando `updated_at`), grava `acao='update'` com o array `mudancas`. Se nenhum campo relevante mudou, não grava.
- Em DELETE: grava `acao='delete'` + snapshot final.
- Captura `auth.uid()` e busca `profiles.email/nome` para armazenar junto (para exibir mesmo se o usuário for removido depois).

### 3. Server function `getPedidoHistorico`

`src/lib/pedido-historico.functions.ts` — usa `requireSupabaseAuth`, retorna as entradas do log ordenadas por `feito_em desc` para um dado `pedido_id` **ou** um dado `pedido_olist` (para achar histórico de pedidos deletados/recriados com o mesmo Olist).

### 4. UI — botão "Histórico" no card do pedido

Novo componente `src/components/pcp/HistoricoPedidoDialog.tsx`:
- Botão pequeno no topo do card (perto de "Duplicar" / "Deletar").
- Abre um `Dialog` com uma timeline:
  - `criado por Wander em 03/07 16:47`
  - `Wander mudou status_pecas de "incompleto" para "completo" em 04/07 09:12`
  - `Flávio marcou dtf_executado em 05/07 14:03`
  - `Juliana deletou o pedido em 06/07 10:20`
- Mostra também entradas de outros pedidos com o **mesmo `pedido_olist`** (para o caso deletado/recriado, aparece linha "outro registro deste Olist deletado em ...").

Nomes de campos técnicos são traduzidos para PT-BR via um pequeno dicionário no componente (`dtf_executado` → "DTF executado", `status_pecas` → "Status de peças", etc.).

## Passos de implementação

```text
1. Migration:
   - CREATE TABLE public.pedido_audit_log + GRANT + RLS + policies
   - CREATE FUNCTION public.log_pedido_change() SECURITY DEFINER
   - CREATE TRIGGER audit_pedidos AFTER INSERT OR UPDATE OR DELETE ON pedidos
2. Aguardar aprovação da migration e regeneração de types.
3. Criar src/lib/pedido-historico.functions.ts (getPedidoHistorico com requireSupabaseAuth).
4. Criar src/components/pcp/HistoricoPedidoDialog.tsx (Dialog + timeline + dicionário de labels).
5. Adicionar botão "Histórico" no card do pedido (DadosInTab / shared header, junto de Duplicar/Deletar).
6. Testar: editar um campo, verificar entrada; deletar, verificar entrada; recriar com mesmo Olist, verificar que timeline mostra os dois registros.
```

## Observações importantes

- **Não retroage.** O 22961 atual não vai ganhar histórico do passado — o log só passa a existir a partir do momento em que a migration rodar. É por isso que estou frisando isto: se hoje já houve uma deleção, ela não vai aparecer. Serve para daqui pra frente.
- Nenhum código existente precisa mudar de comportamento. As telas e mutations continuam iguais.
- Custo em performance é baixo: uma linha inserida por update. Se quiser, podemos podar entradas com mais de N meses depois.
