# Plano — Card "Romaneios com urgência" no Dashboard COP

## Arquivo único alterado
`src/components/cop/DashboardCopTab.tsx`

Nenhum outro arquivo é modificado. Sem migrações. Apenas leituras.

## Novos imports (no mesmo arquivo)
- `rotuloRomaneio`, `linhaUrgente` (na verdade só `rotuloRomaneio`) e tipos `CopUrgencia`, `CopUrgenciaLinha` de `@/lib/cop`.
- `REFACAO_TAMANHOS` de `@/lib/pedidos`.
- `corHex`, `corTextoSobre` de `@/components/pcp/PecasPerdidasEditor`.
- `Flame` de `lucide-react`.

## Nova query (leitura)
- `useQuery(["oficinas-dash"], () => supabase.from("oficinas").select("id, nome"))` — cache padrão, sem realtime.
- Mapa `oficinaNome: Map<string, string>` derivado com `useMemo`.

## Derivação em memória (useMemo)
A partir do `cops` já carregado:

1. Filtra `c.status !== "Finalizado" && (c.urgencias?.length ?? 0) > 0`.
2. Para cada cop:
   - `ultimaEm` = maior `u.em` do array `urgencias`.
   - `qtdPedidos` = `urgencias.length`.
   - Consolida linhas: percorre todas as urgências e todas as `linhas`, agrupando por chave `MODELO|COR` (uppercase).
     - Se qualquer registro da mesma combinação vier sem `tamanhos` (linha inteira), a combinação vira `todos`.
     - Caso contrário, soma `qtd` por `tamanho` (Map<string, number>).
3. Ordena a lista de cops por `ultimaEm` desc.
4. Para cada linha consolidada, ordena tamanhos por `REFACAO_TAMANHOS.indexOf(t)` (desconhecidos vão para o final).

## Estrutura visual do card
`<Card>` em largura total, posicionado **entre** o grid superior (`COPs por status` / `Top urgências`) e o card `Pedidos mais urgentes`.

- `CardHeader`: título `Romaneios com urgência` (`text-base`).
- `CardContent`:
  - Vazio → `<p className="text-sm text-muted-foreground">Nenhuma urgência ativa.</p>`.
  - Preenchido → lista `<ul className="divide-y">`; cada item:
    - Linha superior (`flex items-center gap-2 text-xs`): `Flame` vermelho + `rotuloRomaneio` em negrito + `· {oficinaNome ?? "—"}` + badge `URGÊNCIA` (fundo `bg-red-100 text-red-800`, com `×N` quando `qtdPedidos > 1`) + data `dd/mm` do último pedido (muted, à direita via `ml-auto`).
    - Linhas cobradas (`text-[12.5px] leading-[1.2]`): uma linha por combinação modelo+cor:
      - `MODELO` em negrito
      - chip da cor (mesmo padrão de `PedirUrgenciaDialog`: `inline-block px-1.5 py-0.5 rounded text-[11px] font-bold` com `backgroundColor: corHex(cor)` e `color: corTextoSobre(...)`)
      - tamanhos: `P:2 · M:5 · G:1` (ordem `REFACAO_TAMANHOS`) **ou** `todos os tamanhos` quando marcado como total.

## Não faz parte do escopo
- Nenhum toque em `RomaneioTab.tsx`, `PedirUrgenciaDialog.tsx`, `src/lib/*`, componentes de UI.
- Nenhuma alteração de schema, nenhuma migração, nenhum write no banco.
- Nenhum novo estado global; puro derivado com `useMemo`.

## Critérios de aceite (recap)
- Card aparece na posição descrita, largura total.
- Só lista cops não-finalizados com ≥1 urgência, ordenados pelo último `em` desc.
- Cada item mostra rótulo, oficina, badge `URGÊNCIA` (`×N` quando aplicável) e data dd/mm.
- Linhas cobradas agrupadas por modelo+cor com chip de cor e tamanhos `P:2 · M:5` ou `todos os tamanhos`.
- Tamanhos ordenados por `REFACAO_TAMANHOS` importado (sem hardcode).
- Atualiza em tempo real via canal `cops` já existente — nada novo.
- Apenas `DashboardCopTab.tsx` é modificado.

Aguardando aprovação para implementar.
