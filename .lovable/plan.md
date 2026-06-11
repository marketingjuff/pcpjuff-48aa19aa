## Problema

A aba **Configurações → Listas** mostra "Nenhum item." em todos os quadros (Vendedores, Operadores DTF, Operadores Silk, Responsáveis pelo Acabamento), mesmo com os dados existindo no banco (15 registros em `app_lists`).

## Causa raiz

As políticas de SELECT de `app_lists`, `pedidos` e `feriados` usam a função `public.is_team_member()`, mas essa função **não tem permissão de EXECUTE para o papel `authenticated`**. Resultado: quando o usuário logado consulta a tabela, a checagem de RLS falha silenciosamente e a query retorna vazio.

A função irmã `has_role` tem o grant correto; só `is_team_member` ficou sem.

## Correção (uma migration)

```sql
GRANT EXECUTE ON FUNCTION public.is_team_member() TO authenticated;
```

Depois disso, os 15 itens já populados aparecem normalmente na aba Listas, e as tabelas `pedidos` / `feriados` voltam a respeitar a política `is_team_member()` corretamente.

Nenhuma alteração de UI ou de código de frontend é necessária.