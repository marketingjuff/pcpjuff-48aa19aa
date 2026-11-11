# Controle de Perdas — painel "Onde estamos perdendo" e tabela recolhida

Somente cálculo em tela sobre a lista já filtrada. Nenhuma migração, nenhuma consulta nova, nenhuma dependência nova.

## Arquivo 1 — criar `src/components/cop/PerdasQuebrasPainel.tsx`
- Props: `perdas`, `motivoDe`, `onAbrirDetalhe`.
- Card "Onde estamos perdendo" com grid 1/2 colunas e 7 mini cards, na ordem: área do erro, motivo, área que identificou, modelo, cor, oficina, destino.
- Cada card: soma de peças por grupo (vazio vira "Não informado"; na Oficina, sem oficina fica fora), ordenado do maior para o menor, barra deitada (recharts, `layout="vertical"`), altura `max(120, linhas*28+40)`, total de peças ao lado do título, tooltip "{qtd} peças", barras verdes `#16a34a`; no card Cor cada barra usa `corHex` via `Cell`; cursor de mão.
- Oficina: mensagem "Nenhuma perda com oficina no filtro atual." quando não houver; aviso "{N} peças sem oficina não entram neste gráfico." quando N>0.
- Lista vazia: "Sem dados para os filtros atuais." em cada card.
- Clique na barra abre pop-up (Dialog `max-w-4xl`) só leitura: título "{card} · {barra}", resumo "{peças} peças em {n} lançamentos", tabela com Data, Origem (badge igual à aba), Identificação, Modelo, Cor (chip colorido), Tam., Qtd, Motivo, ordenada da mais recente; rolagem `max-h-[60vh]`. Clique na linha chama `onAbrirDetalhe` e o pop-up fica aberto por baixo.
- A badge de origem e o campo de identificação seguem o mesmo padrão da aba (replicados localmente, já que a aba não pode exportar nada novo além do necessário).

## Arquivo 2 — modificar `src/components/cop/ControlePerdasTab.tsx`
- Inserir `<PerdasQuebrasPainel perdas={filtradas} motivoDe={motivoDe} onAbrirDetalhe={setDetalhe} />` entre os 4 cards de resumo e "Perdas por mês".
- "Perdas consolidadas": envolver em `Collapsible` fechado por padrão (sem salvar estado); cabeçalho inteiro como gatilho com `ChevronDown` girando 180° ao abrir; tabela dentro de `CollapsibleContent`, sem nenhuma outra mudança.
- Filtros, resumo, gráfico mensal e dialogs intocados.

## Verificação
Typecheck e verificação visual somente leitura (abrir aba, clicar barra, abrir/fechar tabela), sem gravar dados.
