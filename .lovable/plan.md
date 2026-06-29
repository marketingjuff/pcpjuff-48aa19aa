## Objetivo

Hoje o Exportar/Importar Backup (em Configurações → PCP) cobre apenas: `pedidos`, `feriados`, `profiles`, `user_roles`. Falta tudo do COP e as configurações globais. Vou ampliar para cobrir **toda a base** do sistema.

## Tabelas incluídas no backup

Passa a exportar/importar todas as tabelas de aplicação:

- `profiles`
- `user_roles`
- `app_color_settings`
- `app_lists`
- `feriados`
- `oficinas`
- `pedidos`
- `cops`
- `cop_perdas`

(Schemas internos do Supabase — `auth`, `storage`, etc. — continuam fora, como deve ser.)

## Ordem de inserção/remoção (respeita dependências)

- Inserção: `profiles` → `user_roles` → `app_color_settings` → `app_lists` → `feriados` → `oficinas` → `pedidos` → `cops` → `cop_perdas`
- Remoção (modo "substituir"): ordem inversa.

`cops` tem auto-referências (`cop_pai_id`, `cop_romaneio_pai_id`). O `upsert` por `id` em lote único resolve isso sem precisar de duas passadas.

## Mudanças técnicas

- `src/lib/backup.functions.ts`: ampliar a constante `TABLES` e as ordens `insertOrder`/`deleteOrder` com as novas tabelas; manter o fluxo atual (admin/gestor para exportar, admin para importar; `upsert` por `id`; modo replace apaga antes).
- Sem mudanças de UI — os botões existentes em Configurações continuam funcionando, agora cobrindo toda a base.
- Sem migração de banco.

## Observação

O arquivo de backup ficará maior (inclui COPs e perdas). O fluxo de download/upload JSON atual continua igual.
