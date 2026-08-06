# Monitor PCP — dias não úteis visíveis e faixa de calor legível

Sem migração, sem coluna nova, sem mudança em nenhuma regra de cálculo. Apenas os 4 arquivos autorizados.

## 1. Eixo passa a mostrar todos os dias corridos

Nova função **separada** em `src/lib/pcp-monitor.ts` (a existente `diasDaJanela` / `diasUteisNoIntervalo`
não é tocada):

```text
diasCorridosDaJanela(de, ate) -> string[]   // todos os dias, inclusive sáb/dom/feriado
```

O `MonitorPcpTab` passa a usar essa lista **só para desenhar** (régua, faixa de calor e Gantt).
A simulação (`simularEtapa`) continua exatamente como está, alocando carga somente em dias úteis.

Marcação visual (via `isDiaUtil` do `dias-uteis.ts`, apenas importado):

- Coluna de dia não útil com fundo cinza na régua, na faixa de calor e no corpo do Gantt.
- Na régua, `sáb 25` / `dom 26` em tom mais apagado.
- Célula de faixa de calor em dia não útil: cinza, vazia, sem número e sem nível.
- Barras do Gantt continuam contínuas — elas são posicionadas por índice de coluna, então
  atravessam o fim de semana sem quebra; muda só o fundo atrás.
- Zoom Semana: agrupamento inalterado (uma coluna = a semana inteira), agora com 7 dias por coluna.
  O passo do arrasto na semana passa de 5 para 7 colunas, para continuar equivalendo a uma semana
  na tela; o cálculo de datas do arrasto continua em dias úteis (`addDiasUteis`), sem alteração.

## 2. Faixa de calor legível no zoom Dia

Célula reformatada em duas linhas centralizadas:

- linha de cima: carga alocada (ex. `882`)
- linha de baixo: teto efetivo em tom claro (ex. `900`)
- carga escorregada: apenas um pontinho `↷` discreto no canto, sem número
- coluna estreita demais (`colWidth` pequeno): só cor + pontinho, números vão para o tooltip

Tooltip completo por célula:

```text
qui 06/08 · Silk
Carga: 882 de 900
120 vieram de dias anteriores por falta de capacidade
```

Zoom Semana: mantém o formato atual (pior dia + rodapé `3/5 dias no limite`).

## Detalhes técnicos

- `colunasDaGrade` continua igual; recebe a lista nova de dias.
- A altura da linha da faixa sobe de 20px para 26px para acomodar as duas linhas de número.
- Nenhuma alteração em `simularEtapa`, `cargaEscorregada`, `pedidosVazados`, `calcInicioAcabamento`,
  `pedidos.ts` ou `dias-uteis.ts`.
