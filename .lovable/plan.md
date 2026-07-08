
# Histórico / Auditoria em PCP, MAP e COP

## Objetivo

Criar 3 novas abas (uma em cada área master): **Histórico PCP**, **Histórico MAP**, **Histórico COP**. Cada aba mostra a linha do tempo de tudo que aconteceu naquela área — quem criou, alterou ou deletou, quando, e o que mudou. Acesso restrito a **admin**.

## Escopo de tabelas auditadas

- **PCP**: `pedidos` (já auditada via `pedido_audit_log`, reaproveita).
- **MAP**: `map_producoes`, `map_tinturaria_programacoes`, `map_malharia_entregas`, `map_estoque_pecas`, `map_devolucoes`.
- **COP**: `cops`, `oficinas`, `cop_perdas`, `pagamentos_consolidados`.

## Como vai funcionar

### 1. Duas novas tabelas de log (mesmo padrão de `pedido_audit_log`)

- `map_audit_log` — colunas: `id`, `tabela` (qual das 5 tabelas MAP), `registro_id` (uuid, sem FK), `identificador` (texto legível: código do fio, oficina, etc.), `acao` (insert/update/delete), `mudancas` (jsonb diff), `linha_completa` (jsonb), `feito_por`, `feito_por_email`, `feito_por_nome`, `feito_em`.
- `cop_audit_log` — mesma estrutura, para as 4 tabelas COP. `identificador` = número/letra do COP, nome da oficina, etc.

Índices em `tabela`, `registro_id`, `feito_em`. RLS: leitura só para admin.

### 2. Função genérica de log + triggers

Uma função `log_generic_change()` SECURITY DEFINER, parametrizada via `TG_ARGV[0]` (nome do log de destino: `map_audit_log` ou `cop_audit_log`) e `TG_ARGV[1]` (nome da coluna a usar como identificador, ex: `codigo`, `numero`, `nome`).

Trigger `AFTER INSERT OR UPDATE OR DELETE` em cada uma das 9 tabelas MAP+COP. Cada trigger passa seus 2 argumentos. Ignora `updated_at` no diff. Não grava se nada relevante mudou.

### 3. Server function `getAuditLog`

`src/lib/audit-log.functions.ts` (`requireSupabaseAuth` + checagem `has_role('admin')` no handler; retorna 403 se não for admin).

Parâmetros:
- `area`: `'pcp' | 'map' | 'cop'`
- `busca?`: texto (procura em `identificador`, `orcamento`, `pedido_olist`)
- `usuarioId?`: uuid
- `acao?`: `'insert' | 'update' | 'delete'`
- `dataInicio?`, `dataFim?`: ISO
- `page`: número (default 1), 200 por página

Retorna `{ entries, total, page, pageSize: 200 }`. PCP consulta `pedido_audit_log`; MAP/COP consultam suas respectivas tabelas.

### 4. Nova aba em cada área master

- `src/components/pcp/HistoricoTab.tsx`
- `src/components/map/HistoricoMapTab.tsx`
- `src/components/cop/HistoricoCopTab.tsx`

Componente compartilhado `src/components/shared/AuditLogView.tsx` que recebe `area` e renderiza:
- Barra de filtros: campo busca, dropdown usuário (populado via `profiles`), dropdown ação, dois datepickers (início/fim), botão limpar filtros.
- Timeline paginada (reaproveita visual do `HistoricoPedidoDialog` existente: badge de ação, autor, data/hora, diff campo-a-campo com labels PT-BR).
- Cada entrada MAP/COP mostra também qual tabela ("Produção", "Tinturaria", "Estoque de peças", "COP", "Oficina", etc.) via mapa de labels.
- Paginação simples (Anterior/Próximo + "página X de Y").

Estado dos filtros vive na URL via `validateSearch` (search params) para o admin poder compartilhar link filtrado.

### 5. Registro das abas + gate admin

Nas 3 rotas master (`_authenticated/index.tsx` = PCP, `/map`, `/cop`), adicionar novo `TabsTrigger` **"Histórico"** que só renderiza quando `useIsAdmin()` for `true`. Se um não-admin navegar direto para `?tab=historico`, mostra "Acesso restrito".

## Ordem de implementação

```text
1. Migration: cria map_audit_log + cop_audit_log (com GRANT + RLS admin-only),
   cria log_generic_change(), cria 9 triggers.
2. Aguardar aprovação + regen de types.
3. src/lib/audit-log.functions.ts (getAuditLog paginado com filtros).
4. src/components/shared/AuditLogView.tsx (filtros + timeline + paginação).
5. HistoricoTab.tsx em pcp/, map/, cop/ (wrappers com area="pcp|map|cop").
6. Adicionar TabsTrigger "Histórico" nas 3 rotas master, gated por useIsAdmin.
7. Testar: editar produção MAP → aparece no Histórico MAP; deletar COP →
   aparece no Histórico COP; filtro por usuário e período funcionando.
```

## Observações

- **Não retroage**: só grava dali pra frente. Dados antigos não aparecem.
- Custo em performance: uma linha inserida por mutação. Índices garantem consulta rápida.
- MAP/COP não têm campos "orçamento"/"olist" como pedidos; o `identificador` textual (código do fio, nº do COP, nome da oficina) é o que aparece na busca e na timeline.
- Labels PT-BR dos campos são estendidas no `AuditLogView` cobrindo também colunas MAP/COP (`gramatura`, `qtd_kg`, `oficina_id`, `pagamento_status` etc.).
- Se depois quiser expor histórico para gestor também, é só afrouxar o gate — a estrutura de dados já está pronta.
