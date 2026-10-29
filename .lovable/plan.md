# KPI — mover vários pedidos de uma vez para o Juff Custom

Só nos 3 arquivos da lista. Sem migração, sem dependência nova.

## 1. src/lib/indicadores-drill.ts
No bloco `acaoEscopo`, dois campos opcionais novos: `onMoverLote?: (numeros: string[]) => void` e `loteEmAndamento?: boolean`. Nada mais muda.

## 2. src/components/kpi/IndicadoresTab.tsx
- Estado `loteEmAndamento` e função `moverEscopoLote` ao lado da `moverEscopo` (que fica intacta): uma única chamada `upsert` em `kpi_pedido_escopo` com `onConflict: "numero_pedido"`, escopo "custom"; depois recarrega os indicadores, fecha o detalhe e mostra o toast com a quantidade. Se der erro: toast de erro e o detalhe continua aberto, com a seleção mantida.
- Em `abrirDrill`, `acaoEscopo` ganha `onMoverLote` (só quando o escopo é Store) e `loteEmAndamento`.
- Um pequeno efeito atualiza `loteEmAndamento` no detalhe já aberto. Sem ele, o botão não passaria para "Movendo…", porque o detalhe guarda uma cópia feita no momento em que abriu.

## 3. src/components/pcp/IndicadorDrillDialog.tsx
- Estado `selecionados` (Set de números). Ele é limpo quando a busca muda, quando o diálogo fecha e quando o payload muda (fim do lote).
- `loteAtivo = !!acao?.onMoverLote`. Se for falso, a tabela fica idêntica à de hoje.
- Elegibilidade: uma função `podeMover(numero)` com o mesmo teste do botão da linha, usada tanto pelo botão quanto pela caixinha. Os números são deduplicados.
- Primeira coluna com Checkbox: no cabeçalho marca ou desmarca as linhas visíveis (fica no estado indeterminado quando só parte está marcada); em cada linha elegível, uma caixinha; nas outras, a célula fica vazia. Clicar na linha não marca nada.
- O colSpan da linha vazia e a célula extra no total somam +1 quando a coluna de seleção aparece.
- Barra acima do rodapé: "N pedidos selecionados · R$ X" (a soma usa a coluna `somar` só das linhas selecionadas, deduplicadas por número), "Limpar seleção" e "Mover para Custom" (fica desabilitado e mostra "Movendo…" durante o lote).
- AlertDialog de confirmação, com o título, o texto e os botões exatamente como no pedido.
- A frase do rodapé muda quando o lote está ativo.

## Ao final
Typecheck e diff em /mnt/documents/diff-mover-escopo-lote.diff.
