# Monitor PCP — faixa vira contagem simples de peças por dia

Sem migração, sem SQL, sem alteração de banco. `pcp_capacidade_etapa` fica intacta, só deixa de ser lida pelo monitor. Apenas 3 arquivos da allowlist são tocados.


## Verificação por grep (feita)
- `nivelDoDia`, `NIVEL_BG` e `Nivel` só são importados em `FaixaCalor.tsx` (dentro da allowlist). Serão removidos de `pcp-monitor.ts`.
- `pedidosVazados` é lido por `GanttPedidos.tsx` (protegido) — continua existindo, sempre vazio. Com isso o ícone "não cabe na capacidade" nunca aparece no Gantt.
- `TETO_PADRAO` é usado por `use-capacidade.ts` — mantido sem alteração.

## src/lib/pcp-monitor.ts
1. `cargaDoPedido`: Arte continua 0 quando o tipo não inclui DTF; senão passa a usar `p.qtd` (Number, isFinite, > 0, senão 0). `n_batidas_dtf` deixa de ser usado.
2. `simularEtapa(pedidos, etapa, feriados)` (sem `teto`): para cada pedido com intervalo e carga > 0, pega `iv.ini`; se não for dia útil, usa `proximoDiaUtil(ini, feriados)`; soma a qtd inteira nesse dia e incrementa `pedidos`. Nada nos outros dias, sem teto, sem escorregar.
3. `DiaCarga = { dia; carga; pedidos }`.
4. `ResultadoEtapa` mantém `pedidosVazados: Set<string>`, sempre vazio.
5. Remover `nivelDoDia`, `NIVEL_BG`, `Nivel`.
6. Não mexer em `TETO_PADRAO`, `calcInicioAcabamento`, `temSegundaOuQuinta`, `inicioAcabamentoDoPedido`, `intervaloEtapa`, `diasUteisNoIntervalo` e demais.
7. Comentário do topo atualizado (contagem de peças por dia de início de etapa).

## src/components/pcp/monitor/FaixaCalor.tsx
1. Título: "Peças programadas por dia".
2. Visão Dia: fundo neutro `bg-muted/30`, mostra só o número de peças do dia (vazio quando 0). Dia não útil continua cinza (`bg-muted`) e vazio. Tooltip: "dia · etapa — N peças em M pedido(s)".
3. Visão Semana: mesmo fundo neutro, mostra a soma de peças da etapa na semana. Tooltip: "dd/mm/aaaa a dd/mm/aaaa · etapa — N peças".
4. Modo recolhido: esconde as quatro linhas de etapa e mantém só a barra do título com o botão Expandir. A linha "Todas as etapas" deixa de existir.
5. O destaque do dia de hoje (contorno vermelho na célula) continua igual.
6. Remover cálculo de nível, `limite`, `teto`, indicador "↷" e imports de `nivelDoDia`/`NIVEL_BG`. Números com separador de milhar pt-BR; fonte encolhe se a coluna for estreita.
7. `ETAPA_COR*`, `COL_ID`, `REGUA_H`, `ReguaDatas` inalterados (usados pelo Gantt).

## src/components/pcp/monitor/MonitorPcpTab.tsx
1. Remover `useCapacidade`, `tetos`, estado `capOpen`, botão de engrenagem "Capacidade" e a renderização de `<CapacidadeDialog>` (arquivo fica no repositório).
2. `simularEtapa(naJanela, e.key, feriados)`; dependências do useMemo sem `tetos`.
3. Legenda: remover "não cabe na capacidade" e as 3 faixas de cor (até 80% / até 100% / acima do teto); manter contagem de pedidos e período.
4. Imports não usados (`Settings`, `CornerDownRight`, se ficarem órfãos) removidos.

## Critérios de aceite
1. Em todas as etapas, inclusive Arte, o número do dia é a soma de peças (qtd) dos pedidos que começam aquela etapa naquele dia.
2. Pedido de 300 peças com DTF de segunda a quarta: 300 na segunda; terça e quarta não recebem nada desse pedido.
3. Início em sábado, domingo ou feriado aparece no próximo dia útil.
4. Pedidos só Silk ou Lisa não entram na linha Arte.
5. Células sem cor verde, amarela ou vermelha e sem limite.
6. Visão semana mostra o total de peças da semana por etapa.
7. Botão de capacidade não aparece e a legenda não fala de teto nem de capacidade.
8. Gantt funciona exatamente como antes (arrastar, abrir detalhe, ícones de atraso e captação de vídeo).
9. Nenhuma migração, nenhum SQL, nenhum arquivo fora da allowlist. `pcp_capacidade_etapa` intacta.

## Validação e entrega
Rodar o typecheck e mostrar o resultado, junto com o diff completo dos três arquivos.
