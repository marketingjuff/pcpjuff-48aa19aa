# Dashboard Master do PCP — filtros múltiplos e soma por seleção de linhas

Sem migração, sem SQL, sem consulta nova. Só 2 arquivos: `src/components/pcp/FiltroMultiSelect.tsx` (novo) e `src/components/pcp/DashboardTab.tsx`. `MultiSelectPeople.tsx`, `shared.tsx`, `pedidos.ts`, `cop-saldos.ts` e `ui/*` ficam intocados.

## 1. `src/components/pcp/FiltroMultiSelect.tsx` (novo)
- Props: `values: string[]`, `options: {value,label}[]`, `onChange(next)`, `placeholder`.
- Popover + PopoverTrigger com `Button variant="outline"` `h-8 w-full justify-between font-normal` e `ChevronDown` à direita.
- Texto: nada marcado → placeholder em `text-muted-foreground`; 1 → label da opção; 2+ → "N selecionados".
- PopoverContent `w-64 align="start"`, lista `max-h-64 overflow-y-auto`, uma linha com Checkbox por opção (alterna sem fechar o popover).
- Botão de texto "Limpar" no fim da lista quando houver algo marcado → `onChange([])`.

## 2. `src/components/pcp/DashboardTab.tsx`

### Entrega A — filtros
- Linhas 48-51: estados viram arrays `etapas: Etapa[] = ["ativas"]`, `vendedoresSel`, `tipos`, `statusSel` (`[]`).
- `useMemo` de `filtrados` (linhas 90-93): etapa vazia vira `["ativas"]` e usa `some(e => pedidoEmEtapa(p, e))`; vendedor/tipo/status filtram só se a lista tiver itens (`includes`, nulos não casam). `pedidoEmEtapa` inalterada. Dependências atualizadas.
- StatCards (174-180): `onClick={() => setEtapas(["x"])}`, `active={etapas.length === 1 && etapas[0] === "x"}`; Atrasados chama `setEtapas(["ativas"])` sem `active`.
- Linhas 196-250: os 4 `Select` viram `FiltroMultiSelect` com os mesmos rótulos, ordem e grade; Etapa mantém as 15 opções com os mesmos nomes (incluindo "ativas"); Vendedor/Tipo/Status sem o item "todos". Placeholders conforme o pedido. Imports de `Select` removidos se ficarem sem uso.
- Limpar Filtros (257): reseta os 4 arrays, data, busca e a seleção de linhas.

### Entrega B — seleção por arraste (só tabela desktop)
- `selectedRowId` vira `selectedIds: Set<string>`; contorno visual igual ao de hoje.
- `useRef` para `arrastando` e `ancora` (índice).
- Na linha: `onMouseDown` (botão esquerdo) → `preventDefault`, âncora = índice, seleção = só a linha; `onMouseEnter` com arraste ativo → intervalo contínuo âncora↔atual; `onDoubleClick` → `onEdit(p.id)` sem mudança; `select-none` mantido.
- `useEffect` registra `mouseup` no `window` para encerrar o arraste, com limpeza.
- `useEffect` limpa a seleção quando `filtrados` muda (filtro, busca, ordenação).
- Barra de totais logo abaixo da tabela desktop, dentro do `CardContent`, fora da área rolável: pequena, à direita, `tabular-nums`.
  - Sem seleção: "Filtrado N pedidos, X peças".
  - Com seleção: "Selecionado N pedidos, X peças" + botão "Limpar seleção".
  - Se as peças de refação forem maiores que zero: "(original + extras de refação)" menor e esmaecido.
  - Soma usa `totalProducao(p).total` (o mesmo número da coluna QTD); import direto de `totalProducao` de `@/lib/pedidos` só se ainda não estiver importado; valores ausentes contam como 0. Tudo calculado em `useMemo` sobre `filtrados` e `selectedIds`.
- Cards mobile, ordenação, `stats` e colunas sem alteração.

## Ao final
`bunx tsgo --noEmit -p tsconfig.json` e o log de build, mais o diff completo dos 2 arquivos.
