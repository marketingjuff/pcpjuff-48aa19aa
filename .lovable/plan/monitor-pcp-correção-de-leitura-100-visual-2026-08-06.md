# Monitor PCP — correção de leitura (100% visual)

Sem migração de banco. Sem mudança em nenhuma regra de cálculo. Só os 3 arquivos autorizados
(`MonitorPcpTab.tsx`, `monitor/FaixaCalor.tsx`, `monitor/GanttPedidos.tsx`) — o `MonitorPcpTab.tsx`
do projeto está em `src/components/pcp/monitor/`.

## 1. Régua de datas (novo cabeçalho)

Cabeçalho de duas linhas, colado no topo da área de rolagem (sticky vertical, acompanha a rolagem
horizontal):

- Linha de cima: mês/ano agrupado (`AGO 2026`, `SET 2026`), com separador entre meses.
- Linha de baixo: zoom Dia → `seg`/`10` em duas linhas; zoom Semana → `10–14 ago`.
- Coluna de hoje com fundo destacado; linha vermelha vertical atravessando régua, faixa e Gantt.
- Grade vertical mais visível em toda a altura.

Observação: a grade do Monitor é montada só com **dias úteis** (sábados, domingos e feriados já não
existem como coluna). Então não há coluna cinza de fim de semana a pintar; em vez disso a régua marca
a quebra de semana com um separador mais forte, para não perder a noção de fim de semana.

## 2. Faixa de calor no lugar certo

A `FaixaCalor` passa a ficar fixa logo abaixo da régua (sticky com `top` calculado a partir da altura
da régua), acima da lista, sem rolar com os pedidos. Padrão **expandida** (Arte / DTF / Silk /
Acabamento), com botão de recolher para linha única ao lado.

## 3. Zoom padrão Semana + rolagem em "hoje"

Valor inicial `semana` quando não há nada salvo (persistência mantida). Ao montar, a área rola
horizontalmente até a coluna de hoje (centralizada), uma única vez.

## 4. Legenda das etapas

Barra de legenda no cabeçalho do Monitor, junto da legenda de carga já existente:
◆ Arte · ▬ DTF · ▬ Silk · ▬ Acabamento · ⚑ Saída Juff · 📷 captação de vídeo · ⚠ etapa vencida.
Uma cor fixa por etapa, usada igual no Gantt e nas sublinhas da faixa de calor. Barra de estamparia
bicolor só quando o tipo inclui DTF **e** Silk (comportamento atual mantido).

## 5. Densidade das linhas

Altura da linha de 46px → ~34px (marcadores reposicionados), coluna de identificação do pedido sticky
na horizontal (fica visível ao rolar para os meses seguintes) e zebra sutil alternando o fundo.

## 6. Tooltip

Tooltip por barra/marcador com nome da etapa, datas em formato brasileiro e quantidade, ex.:
`Estamparia · 10/08/2026 a 12/08/2026 · 300 pçs`.

## Detalhes técnicos

- Tokens de cor por etapa em uma constante local no `MonitorPcpTab.tsx`, passada por prop para
  `FaixaCalor` e `GanttPedidos` (nada novo exportado de `pcp-monitor.ts`).
- Sticky em duas camadas dentro de `#monitor-scroll`: régua `top-0 z-30`, faixa `z-20`; coluna
  esquerda `sticky left-0` com fundo opaco em régua, faixa e linhas.
- Scroll inicial em "hoje" via `useEffect` com ref no container, dependente de `dias`/`colWidth`.
- Nenhuma alteração em filtros, arrasto, diálogos, permissões ou salvamento.
