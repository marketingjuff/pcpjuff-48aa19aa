## Objetivo
Três ajustes só de frontend no COP. Sem migrações, sem tocar em `cop-saldos.ts`.

## Item 1 — Popup ao clicar em número negativo (Falta por Pedido)

**Arquivo novo:** `src/components/cop/FaltaPecaPopup.tsx`
- Props: `open`, `onOpenChange`, `modelo`, `cor`, `tamanho`, `pedidos: Pedido[]` (todos os pedidos da aba), `cops: Cop[]`, `oficinas: Oficina[]`.
- Layout 2 colunas (`grid-cols-1 md:grid-cols-2 gap-4`) dentro de um `Dialog` (`max-w-[900px]`).
- **Esquerda — Romaneios:** filtra `cops` cujo `pecas[]` contém a combinação `modelo+cor+tamanho` E que estejam em oficina (usar `copAtivoEmOficina` de `cop-oficinas.ts`). Card por COP: `rotuloRomaneio`, oficina (lookup por `oficina_id`), `data_saida` ou similar, `status`, e a `qtd` da peça naquele COP menos o que já foi recebido (`pecas_recebidas` por modelo+cor+tamanho). Card com `<a href="/cop?tab=romaneio&copId={id}" target="_blank">`.
- **Direita — Pedidos:** filtra a lista de `pedidos` passada onde `pecas_solicitadas` contém a peça com `qtd - qtd_enviada > 0`. Card: `orcamento`, `pedido_olist`, responsável (se houver), `dataUrgencia`, status/etapa (`calcularEtapaAtual`), quantidade faltante. `<a href="/?tab=dados&pedidoId={id}" target="_blank">`.
- Se lista vazia num dos lados, mostrar "Nenhum" — sem erro.

**`src/components/cop/FaltaPorPedidoTab.tsx`:**
- Buscar `oficinas` (nova `useQuery ["oficinas"]`) e passar ao popup.
- Adicionar `useState<{ modelo, cor, tamanho } | null>` para popup.
- No `<td>` de cada tamanho negativo (linha 251-254) e no total do grupo (linha 256) — apenas o de tamanho recebe click; o do total permanece como está. O `-{info.falta}` vira `<button>` que chama `setPopup(...)` e `e.stopPropagation()` (para não abrir o histórico).
- Renderizar `<FaltaPecaPopup ... />` no fim.

## Item 2.1 — Baixa inicia em branco

**`src/components/cop/BaixaCopDialog.tsx`:**
- No `useEffect` que popula `qtds` ao abrir (linhas 33-38): trocar `next[it.tamanho] = it.falta` por `next[it.tamanho] = 0`. Nenhuma outra mudança de gravação.

## Item 3 — Falta negativa no Disponível

**`src/components/cop/DisponivelTab.tsx`:**
- Cada célula de tamanho (linhas 167-190): quando `presente && v > 0 && falt > 0`, exibir `-{falt}` em `text-red-700` no lugar do valor `v`, com o mesmo botão/popup atuais. Se `falt === 0`, manter comportamento atual (mostrar `v`).
- **Só apresentação.** `calcDisponivel` intocado. `totaisTam`/`totalGeral` continuam somando `disponivel` original (não mudam).
- Popup interno já mostra falta separadamente — sem mudança.

## Suporte a "abrir em nova guia"

**`src/routes/_authenticated/cop.tsx`:**
- Adicionar `validateSearch: (s) => ({ tab: typeof s.tab === "string" ? s.tab : undefined, copId: typeof s.copId === "string" ? s.copId : undefined })`.
- No componente, `const { tab: tabParam, copId } = Route.useSearch()`. `useEffect` inicial: se `tabParam` seta `setTab(tabParam)` e se `copId` seta `setCopSelId(copId)`.

**`src/routes/_authenticated/index.tsx`:**
- Adicionar `validateSearch: (s) => ({ tab: typeof s.tab === "string" ? s.tab : undefined, pedidoId: typeof s.pedidoId === "string" ? s.pedidoId : undefined })`.
- `useEffect` inicial: se `tab`/`pedidoId` presentes, aplicar via `setTab` e `setSelectedId` (respeitando permissões — se não puder ver a aba, ignora).

## Fora de escopo
- Sem alterações em `cop-saldos.ts`, schema, RLS, ou outras abas.
- Sem novos endpoints. Sem novas dependências.

## Aceite
1. Falta por Pedido: campo de baixa inicia vazio (usuário digita).
2. Falta por Pedido: clicar em `-N` de um tamanho abre popup 2 colunas com romaneios (esquerda) e pedidos (direita) daquela peça específica.
3. Cards do popup abrem `/cop?tab=romaneio&copId=…` e `/?tab=dados&pedidoId=…` em nova guia com pré-seleção correta.
4. Disponível: célula com faltante mostra `-{falta}` em vermelho quando há falta > 0, sem mexer nos totais/cálculos.
