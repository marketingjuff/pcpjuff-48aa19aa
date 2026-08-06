# Monitor PCP — correção de leitura

Sem migração, sem coluna nova, sem mudar nenhuma fórmula de carga/teto/simulação. Arquivos tocados:
`MonitorPcpTab.tsx`, `monitor/FaixaCalor.tsx`, `monitor/GanttPedidos.tsx` e `src/lib/pcp-monitor.ts`
(apenas para registrar, durante a mesma varredura já existente, quanto da carga do dia veio de
escorregamento — nenhum número de alocação muda). `src/lib/pedidos.ts` só é importado.

## 1. ⚠ atraso separado de ↷ capacidade

- Passa a usar `isAtrasadoSetor(p, setor)` de `src/lib/pedidos.ts` para as 4 etapas.
- ⚠ vermelho na linha do pedido quando alguma etapa está atrasada; tooltip diz qual
  (ex.: "Silk atrasado — início era 28/07 e ainda não foi batido"). O ⚠ aparece também na barra da
  etapa atrasada.
- ↷ âmbar continua sinalizando vazamento de capacidade (`pedidosVazados`), com tooltip próprio.
- Filtro "Só atrasados" passa a usar `isAtrasadoSetor`, não vazamento.

## 2. Concluído vs pendente

Por segmento: concluída (`status_arte === "Arte Finalizada"`, `dtf_estampado/silk_feito === "Sim"`,
`embalado === "Sim"`) → barra sólida com ✓ discreto na ponta e tooltip "Concluída"; pendente → barra
clara (contorno na cor da etapa, preenchimento suave) e tooltip "Pendente".

## 3. Faixa de calor em número absoluto

Célula mostra `820 / 900` (carga alocada / teto efetivo). Havendo carga vinda de dias anteriores por
falta de capacidade: `700 + 120↷ / 900`, com tooltip explicando a origem. Cores inalteradas. No zoom
Semana continua o pior dia + rodapé `3/5 dias no limite`.

## 4. Zoom Dia como padrão

Sem valor salvo, abre em Dia (persistência e botão mantidos) e a rolagem já vai para "hoje".

## 5. Arte vira barra

Barra de `entrada_pedido` até `arte_data`, com a ponta direita (o limite) destacada. Se
`entrada_pedido` for nulo ou posterior ao `arte_data`, mantém o losango pontual atual.

## 6. Bandeira verde da entrada

Marcador de bandeira verde em `entrada_pedido`, no começo da linha.

## 7. Legenda

⚑ verde Entrada do pedido · ▬ Arte (barra até o limite) · ▬ DTF · ▬ Silk · ▬ Acabamento · ⚑ Saída Juff ·
▬ sólida = concluída / ▬ clara = pendente · 📷 captação de vídeo · ⚠ etapa atrasada · ↷ não cabe na
capacidade. Cor fixa por etapa, igual no Gantt e na faixa de calor; estamparia bicolor só em DTF+Silk.

## Detalhes técnicos

- `DiaCarga` ganha um contador de exibição (`cargaEscorregada`) alimentado dentro do laço atual da
  simulação; a distribuição, o teto efetivo e `pedidosVazados` seguem idênticos.
- Helpers locais de "etapa concluída" e "etapa atrasada" no `MonitorPcpTab.tsx`, passados por prop para
  o Gantt (nada novo em `pedidos.ts`).
- Nenhuma alteração em arrasto, diálogos, permissões, filtros restantes ou salvamento.
