# Início real da Arte + "Espera no Dados In" (KPI PCP)

Objetivo: registrar automaticamente no banco o momento em que o pedido realmente chega na Arte (primeiro save do Input de Produção), corrigir o cálculo da etapa Arte no KPI e criar a linha nova "Espera no Dados In" com o tempo que hoje está escondido dentro da Arte.

## 1. Migração nova (`supabase/migrations/<nova>.sql`) — só aditiva, nesta ordem

**Passo 1 — coluna:** `ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS arte_iniciou_em timestamptz NULL;` + `COMMENT ON COLUMN`.

**Passo 2 — backfill (ANTES de criar o trigger):** para cada pedido, o menor `feito_em` do `pedido_audit_log` entre (a) `acao = 'update'` com elemento de `mudancas` de `campo = 'tipo_estampa'` e `para` não nulo/vazio e (b) `acao = 'insert'` com `linha_completa->>'tipo_estampa'` não nulo/vazio. O `UPDATE` roda com `WHERE arte_iniciou_em IS NULL` **e** só atinge pedidos em que esse `feito_em` foi realmente encontrado (subconsulta com valor não nulo) — os demais permanecem `NULL`, sem fallback. Escreve apenas nessa coluna. O backfill vem antes do trigger justamente para que pedidos antigos sem log não recebam a data de hoje.

**Passo 3 — função:** `CREATE OR REPLACE FUNCTION public.set_arte_iniciou_em()` (`SECURITY DEFINER`, `SET search_path = public`): se `NEW.arte_iniciou_em IS NULL` e `status_pecas` e `tipo_estampa` estão preenchidos (não nulos, não vazios) → `NEW.arte_iniciou_em := timezone('America/Sao_Paulo', now())` (horário de Brasília, para o `slice(0, 10)` do KPI cair no dia certo em saves de fim de tarde/noite). Nunca sobrescreve valor já existente, nunca zera.

**Passo 4 — trigger:** `CREATE TRIGGER trg_arte_iniciou_em BEFORE INSERT OR UPDATE ON public.pedidos FOR EACH ROW` (separado do trigger de auditoria, que continua intocado).

Sem `DROP`, `TRUNCATE`, `DELETE` ou alteração de coluna existente.


## 2. `src/lib/audit-labels.ts`

Adicionar `arte_iniciou_em: "Entrada na Arte (automático)"`. Nada mais.

## 3. `src/lib/kpi-pcp.ts`

- `ETAPAS_TEMPO` passa a começar com `"Espera no Dados In"`.
- Helper local `arteIniciou(p)` devolvendo `YYYY-MM-DD` de `arte_iniciou_em` (lido via cast, sem tocar o tipo `Pedido`) ou `null`.
- Dentro de `tempoBloco`, helper `soReal(etapa, ra, rb)`: empurra só em `real[etapa]`, não em `plan`, e não marca `entrou` (cobertura/`elegiveis` inalterados).
- `soReal("Espera no Dados In", p.entrada_pedido, arteIniciou(p))` para todos os tipos, inclusive Lisa.
- Arte passa a `par("Arte", arteIniciou(p), p.arte_data, arteIniciou(p), arteLiberou(p))`.
- Nenhuma outra mudança de cálculo: `media`, `p80`, `arteLiberou*`, `fimEstamparia`, faixas, `porMes` e o bloco de refação seguem iguais. `maiorFolga` ignora a espera (diferença nula); `gargalo` pode incluí-la.

## 4. `src/components/kpi/KpiPcpTab.tsx`

A tabela já renderiza `—` quando `planejadoMedio`/`diferenca` são nulos, então a linha nova entra sem quebrar. Adicionar abaixo da tabela uma nota em `text-xs text-muted-foreground` explicando o que é "Espera no Dados In" e que pedidos anteriores ao registro automático não entram na conta.

## Observações técnicas

- O campo não aparece em nenhuma tela de operação; só banco, KPI e histórico de auditoria (automático).
- Fora da allowlist nada é alterado: em `kpi-pcp.ts` o campo é lido por cast, para não editar `src/lib/pedidos.ts`. `src/integrations/supabase/types.ts` só é regenerado automaticamente pela migração.
