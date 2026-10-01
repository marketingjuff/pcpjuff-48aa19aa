# Correção dos cards Rendimento e Rendimento por modelo (KPI COP e MAP)

Nenhuma migração, nenhum SQL. Só grava/lê a chave `kpi_cobertura_minima` em `map_config` pelo app (upsert), padrão 70.

## Arquivos (exatamente 2)
- `src/lib/kpi-cop-map.ts`
- `src/components/kpi/KpiCopMapTab.tsx`

Todo o resto intocado (map.ts, cop.ts, KpiCopMapDrill.tsx, Estoque de MP etc.).

## 1. `src/lib/kpi-cop-map.ts`
- `blocoTecido(ctx, pecasTecido, piso = 70)` ganha o parâmetro `piso`. Os loops atuais (`linhas`, `rateado`, `exato`, `copsUsados`, `pecasDosCops`) ficam como estão e continuam alimentando só os cards de metros, abertas e zeradas. `pecasDosCops` e o cálculo antigo de rendimento são removidos.
- Caminho novo, separado:
  - a. Índice de metros por COP: varre todos os `cortes` de todas as peças de tecido, **sem filtro de data**, somando metros por `cop_id` (e por cor do tecido).
  - b. Conjunto do rendimento: COPs com `execucao_corte` no período, oficina passando no filtro e com pelo menos uma peça que passe em modelo/cor (mesmo recorte do bloco Corte).
  - c. Peças consideradas de cada COP: as que passam no filtro de modelo/cor. Metros: total lançado no COP (com filtro de modelo, rateado pela proporção do modelo; com filtro de cor, só o tecido daquela cor).
  - d. COP com metros > 0 = "com metragem"; os demais ficam fora do numerador e do denominador.
  - e. Por modelo: rateio pela proporção de peças do modelo no COP; COP sem metragem fica fora de todos os modelos dele.
  - f. Cobertura = COPs com metragem ÷ COPs do recorte (para o modelo, os COPs com pelo menos uma peça dele).
- Novo tipo `MetricaRend = Metrica & { cobertura, semMetragem, totalCops, estado: "ok" | "atencao" | "incompleto" | "vazio" }`. Estado: ≥90% ok; ≥ piso atenção; abaixo do piso incompleto (texto "incompleto"); sem COPs → "—".
- Popup: uma linha por COP (e por modelo no ranking) com peças e metros; COP sem metragem aparece com metros vazio e Obs. "sem metragem lançada".

## 2. `src/components/kpi/KpiCopMapTab.tsx`
- `useQuery` lendo `map_config` chave `kpi_cobertura_minima` (`maybeSingle`), valor inválido/ausente/fora de 0–100 → 70. `useMutation` com upsert, invalida a query, `toast` de sucesso.
- Piso passado ao `blocoTecido` (período atual e anterior).
- Card Rendimento: número ou "incompleto", selo ATENÇÃO quando couber, texto "3 de 19 cortes ainda sem metragem lançada". Admin (`useIsAdmin`) vê campo curto (sem setinhas) + botão Salvar; demais veem "Piso de cobertura: 70%".
- Ranking Rendimento por modelo: mantém selo ESTIMATIVA; cada item mostra ATENÇÃO ao lado quando couber, "incompleto" no lugar do número quando abaixo do piso, texto de cortes sem metragem; continua clicável.
- Rodapé dos dois cards: "Base: dia da execução do corte do COP. Metragem: toda a lançada naquele COP, em qualquer data."

## Final
Typecheck + diff completo dos 2 arquivos em /mnt/documents/.
