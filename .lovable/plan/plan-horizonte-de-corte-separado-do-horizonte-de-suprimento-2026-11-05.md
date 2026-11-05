# PLAN — horizonte de corte separado do horizonte de suprimento

## Verificações já feitas
- `plan_config.chave` é a chave primária (`plan_config_pkey PRIMARY KEY (chave)`), então o `ON CONFLICT (chave) DO NOTHING` é válido.
- Busca: `useHorizontePlan`, `HorizonteSelect` e `usePlanLinhas` só aparecem em `NecessidadeTab.tsx` e `TinturariaTab.tsx` (o único outro consumidor).
- Hoje o banco tem `horizonte_meses_padrao = 3` e `semanas_seguranca = 1`; nada disso muda.

## Arquivo por arquivo

1. `src/lib/plan.ts` — só acrescentar `horizonte_corte_meses_padrao: 2` em `CONFIG_PADRAO`. Nenhum cálculo muda.

2. `src/components/plan/NecessidadeTab.tsx`
   - Constantes `HORIZONTES_SUPRIMENTO = [3,5,6]`, `HORIZONTES_CORTE = [1,2,3]`, `LS_HORIZONTE_SUPRIMENTO = "plan:horizonte"` (mantida), `LS_HORIZONTE_CORTE = "plan:horizonte-corte"`.
   - Um helper interno com a mesma mecânica de hoje (localStorage + evento de janela + padrão do `plan_config`), usado por `useHorizonteCorte()` (evento `plan-horizonte-corte`, padrão `horizonte_corte_meses_padrao`) e `useHorizonteSuprimento()` (evento `plan-horizonte`, padrão `horizonte_meses_padrao`).
   - `HorizonteCorteSelect` ("Cobrir corte por:" 1 mês / 2 meses / 3 meses) e `HorizonteSuprimentoSelect` ("Cobrir suprimento por:" 3 / 5 / 6 meses), mesmo visual de hoje.
   - Remover `useHorizontePlan` e `HorizonteSelect`.
   - `usePlanLinhas(escopo = "corte")` chama os dois hooks sempre e usa o valor do escopo em `montarNecessidade` e nas dependências do `useMemo`.
   - A aba usa `usePlanLinhas("corte")`, `<HorizonteCorteSelect />` e a frase explicativa em `text-xs text-muted-foreground`.

3. `src/components/plan/TinturariaTab.tsx` — importar `HorizonteSuprimentoSelect`, usar `usePlanLinhas("suprimento")`, trocar o seletor e acrescentar a frase dos 65 dias. Nada mais.

4. `src/components/plan/ParametrosTab.tsx` — em `ROTULOS`, renomear o rótulo existente para "Horizonte inicial de suprimento (meses)" e acrescentar "Horizonte inicial de corte (meses)".

5. Banco — o INSERT exato do pedido, apenas uma linha nova em `plan_config`.
   - Ponto de atenção: neste projeto as mudanças de banco são gravadas em `drizzle/migrations/` (é onde está `0002_plan_modulo.sql`), não em `supabase/migrations/`, e a ferramenta de migração recusa inserções de dados. Proposta: executar o INSERT pela ferramenta de dados (uma linha, `ON CONFLICT DO NOTHING`) e **não** criar arquivo de migração. Se preferir o arquivo em `supabase/migrations/`, aviso que ele não seria aplicado automaticamente.

## Ao final
- Busca confirmando que `useHorizontePlan`/`HorizonteSelect` não existem mais em nenhum arquivo.
- Comparação de números: corte em 3 meses = números atuais da Necessidade; suprimento em 3 meses = quilos atuais da Tinturaria.
- Typecheck com o resultado mostrado.
