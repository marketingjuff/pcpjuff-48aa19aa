## Objetivo

Ajustar somente o dropdown de filtro **Etapa** em cada aba e a lógica de agregação das opções "Aguardando DTF" e "Aguardando Silk". Nenhuma outra coisa muda (colunas, StatCards, cores, demais filtros).

## 1. Lógica de agregação (arquivo `src/components/pcp/shared.tsx`)

Em `_ETAPA_MAP`, ampliar os arrays:

- `dtf` → `["Aguardando DTF", "Aguardando DTF + Silk", "DTF Liberado / Silk na Arte", "Silk Liberado / DTF na Arte"]`
- `silk` → `["Aguardando Silk", "Aguardando DTF + Silk", "DTF Liberado / Silk na Arte", "Silk Liberado / DTF na Arte"]`

As demais entradas do mapa permanecem iguais. Assim o efeito vale automaticamente em Dashboard Master e todas as abas.

## 2. Opções por aba

Hoje todas as abas iteram sobre a constante única `ETAPA_FILTRO_OPCOES`. Vou criar listas filtradas por aba, exportadas do mesmo `shared.tsx`, mantendo nomes/rótulos/ordem originais:

- `ETAPA_FILTRO_OPCOES` → permanece intacta (usada pelo Dashboard Master).
- `ETAPA_FILTRO_OPCOES_DADOS_IN` → tudo menos `pendencias_arte`.
- `ETAPA_FILTRO_OPCOES_ARTE` → `ativas`, `arte`, `dtf_pronto_silk_arte`, `silk_pronto_dtf_arte`, `dtf`, `silk`, `dtf_silk`.
- `ETAPA_FILTRO_OPCOES_DTF` → `ativas`, `arte`, `dtf_pronto_silk_arte`, `silk_pronto_dtf_arte`, `dtf`, `dtf_silk`.
- `ETAPA_FILTRO_OPCOES_SILK` → `ativas`, `arte`, `dtf_pronto_silk_arte`, `silk_pronto_dtf_arte`, `silk`, `dtf_silk`.
- `ETAPA_FILTRO_OPCOES_ACABAMENTO` → tudo menos `pendencias_arte`.
- `ETAPA_FILTRO_OPCOES_EXPEDICAO` → `ativas`, `acabamento`, `expedicao`, `finalizados`.

Observação: o rótulo de `ativas` (`"Todas (menos finalizados)"`) é o que aparece como "Todas" no requisito; mantenho o texto original conforme a regra "não mudar nomes/rótulos".

## 3. Trocas pontuais nos imports/usos

Em cada arquivo abaixo, trocar apenas a constante usada no `.map()` do SelectContent do filtro de etapa:

- `src/components/pcp/DadosInTab.tsx` → `ETAPA_FILTRO_OPCOES_DADOS_IN`
- `src/components/pcp/ArteTab.tsx` → `ETAPA_FILTRO_OPCOES_ARTE`
- `src/components/pcp/DTFTab.tsx` → `ETAPA_FILTRO_OPCOES_DTF`
- `src/components/pcp/SilkTab.tsx` → `ETAPA_FILTRO_OPCOES_SILK`
- `src/components/pcp/AcabamentoTab.tsx` → `ETAPA_FILTRO_OPCOES_ACABAMENTO`
- `src/components/pcp/ExpedicaoTab.tsx` → `ETAPA_FILTRO_OPCOES_EXPEDICAO`
- `src/components/pcp/DashboardTab.tsx` → **sem alteração** (continua usando a lista completa ou hardcoded existente).

Nada mais é tocado: lógica de `matchEtapaFiltro`, filtros adjacentes, colunas, StatCards e paleta de cores ficam inalterados.