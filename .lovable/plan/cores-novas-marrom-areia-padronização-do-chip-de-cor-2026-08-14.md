# Cores novas (marrom/areia) + padronização do chip de cor

Só frontend. Sem migração, sem mudança de banco. Apenas os arquivos da allowlist.

## 1. `src/lib/pedidos.ts`
Adicionar em `REFACAO_CORES`, na posição alfabética:
- `{ nome: "areia", hex: "#d6d1c9" }` (depois de "amarelo flúor", antes de "azul índigo")
- `{ nome: "marrom", hex: "#342423" }` (depois de "marinho", antes de "menta")

Como o array é a fonte única, as duas cores passam a aparecer automaticamente em todos os seletores de PCP/COP/MAP e na ordenação "de corte".

## 2. Texto puro → chip (fundo colorido + nome legível)
Sempre com `corHex(nome)` + `corTextoSobre(hex)` importados de `@/components/pcp/PecasPerdidasEditor` (import adicionado só onde ainda não existe). Nenhuma função nova de cor.

- `src/components/cop/AlimentacaoEstoqueTab.tsx` (linha ~345): `<td>{it.cor}</td>` → chip.
- `src/components/cop/DashboardCopTab.tsx` (linha ~219): em `{x.modelo} · {x.cor} · {x.tamanho}`, só a cor vira chip.
- `src/components/cop/FaltaPorPedidoTab.tsx` (linha ~456): `<td>{log.cor}</td>` → chip.
- `src/components/cop/RomaneioTab.tsx` (linhas ~823 e ~1018): `{p.modelo} · {p.cor} · {p.tamanho}` e `<td>{item.cor}</td>` → mesmo chip já usado nas linhas 607/969/1396 do arquivo.
- `src/components/cop/CorrigirPerdaDialog.tsx` (linha ~92): em "Item: modelo · cor · tamanho", só a cor vira chip.
- `src/components/pcp/PecasCompletadasPanel.tsx` (linhas ~146 e ~179): nas duas ocorrências, só a cor vira chip.
- `src/components/map/ReceberPecaCorrigidaDialog.tsx` (linha ~93): "Cor ao voltar" vira chip; sem cor, mantém "—" sem chip.

## 3. Bolinha → chip
- `src/components/map/MapConfigPanel.tsx` (tabela "Acabamento por cor"): remover a coluna da bolinha (`h-5 w-5 rounded-full`) e o header correspondente; a coluna do nome passa a exibir o chip com fundo `c.hex` e texto via `corTextoSobre`.

## Fora do escopo
- Badges de status/quantidade (`PerdasTab`, `RefazerPerdaDialog`, `PedirUrgenciaDialog`, `BaixaCopDialog`, `EntregaRomaneioDialog`) — intocados.
- `cop-saldos.ts`, SUP e qualquer chip que já está correto.

## Verificação
Typecheck + conferência visual: marrom com texto branco, areia com texto escuro; nenhuma bolinha isolada restante nos pontos citados.
