# Lote de melhorias PCP + MAP

Sem mudanças de schema. Apenas edições nos arquivos listados. Execução de tudo em uma tacada só após aprovação.

## Bloco 1 — PCP · Refação em linha única com grade completa
**Arquivos:** `PecasPerdidasEditor.tsx`, `RefacaoDialog.tsx`, `RefacaoViewerButton.tsx`

- **`ChipGrouped` (visualização/colapsado):** reescrever para uma linha única com colunas fixas na ordem `Modelo | Cor | PP | P | M | G | GG | EXG | EXXG | Total`. Iterar `REFACAO_TAMANHOS` inteiro, mostrar `-` quando 0/vazio. Larguras: tamanhos `w-10 text-center tabular-nums`, Modelo `w-32 uppercase font-semibold`, Cor `w-28` com fundo `corHex` + `corTextoSobre` negrito. Sem `flex-wrap`; container com `overflow-x-auto`. No modo `readOnly`, um cabeçalho com os rótulos alinhado às colunas.
- **Linha expandida editável:** trocar `flex-wrap` por layout horizontal com as mesmas larguras fixas. Todos os tamanhos sempre visíveis; `overflow-x-auto` se preciso. Cor no select mantém fundo + negrito.
- **Dialogs:** `RefacaoDialog` `max-w-2xl` → `max-w-4xl`; `RefacaoViewerButton` `max-w-3xl` → `max-w-5xl`.
- Não tocar em `groupFromFlat`, `flattenRows`, `serialize`, `somaLinha` nem nas constantes `REFACAO_*`.

## Bloco 2 — PCP · Dashboard: filtro "Em refação"
**Arquivo:** `DashboardTab.tsx`

- Adicionar `"em_refacao"` ao `type Etapa`.
- Em `pedidoEmEtapa`, antes do mapa atual: se `e === "em_refacao"`, retorna `p.refacoes?.some((ep) => ep.aberto === true)`.
- Novo `<SelectItem value="em_refacao">Em refação</SelectItem>` logo após "Todas (menos finalizados)". Nada mais muda.

## Bloco 3 — MAP · Quebra: conciliada não some, card-resumo, clique abre PROD
**Arquivos:** `QuebraTab.tsx`, `map.tsx`, `ProgramacaoFiosTab.tsx`

- **QuebraTab:**
  - Filtro padrão passa de `"pendente"` para `"todas"`.
  - Linhas com `quebra_conciliada === true` recebem fundo `bg-emerald-50` no `<tr>` (mantém badge e "Desfazer baixa").
  - Novo card-resumo no topo (estilo MAP, só leitura): Pendentes (`false`), Conciliadas (`true`), Quebra total (soma `kg`).
  - Linha clicável: `useNavigate` do `@tanstack/react-router`; `<tr>` `cursor-pointer` → `navigate({ to: "/map", search: { tab: "programacao", prodId: prod.id } })`. `e.stopPropagation()` nos botões de ação e no Select de filtro.
- **map.tsx:** passar `prodId={search.prodId}` para `<ProgramacaoFiosTab />` (a rota já valida `prodId`).
- **ProgramacaoFiosTab:** aceitar prop `prodId?: string` e repassar para `MapFiosTable` como `focusProdId`. Não mexer em `FiosFinalizadosTab`.
- **MapFiosTable:** nova prop `focusProdId?: string`. Adicionar `id={\`map-prod-${prod.id}\`}` no `<tr>` de resumo (o com `summaryClass`). `useEffect` sobre `focusProdId`: expande a PROD, `setTimeout(120)` faz `scrollIntoView({behavior:"smooth", block:"center"})` e limpa o `prodId` da URL via `navigate({ to: "/map", search: (prev) => ({ ...prev, prodId: undefined }), replace: true })`.

## Bloco 4 — MAP · Tinturaria: Kg env. sempre + split automático
**Arquivo:** `TinturariaBlock.tsx`

- **Kg env. sempre:** dentro de `commit`, quando `field === "pecas"`: remover a condição `row.kg_enviados == null`. Numérico + `kgPorPeca > 0` → `patch.kg_enviados = n * kgPorPeca`; peças vazias/null → `patch.kg_enviados = null`.
- **Split automático:** depois de aplicar o patch do campo, montar `merged = { ...row, ...patch }` e checar:
  1. Recebimento completo: `kg_recebidos`, `pecas_recebidas`, `data_recebimento`, `nota_fiscal_recebimento` todos preenchidos.
  2. Falta peça: `pecas_recebidas < pecas`.
- Se ambas verdadeiras e `faltantes > 0`:
  1. Aplicar o patch normal (recebimento persiste).
  2. `patchProgramacao(row.id, { pecas: recebidas, kg_enviados: recebidas * kgPorPeca })` — recebimento permanece.
  3. `INSERT` em `map_tinturaria_programacoes` com `producao_id`, `tinturaria`, `data_programacao`, `cor` copiados; `pecas = faltantes`, `kg_enviados = faltantes * kgPorPeca`; recebimento em branco; `created_at = row.created_at + 1ms` para ficar logo abaixo.
  4. `onChanged()` uma vez ao final.
- Idempotente: como `pecas` da original vira `recebidas`, a condição "falta peça" deixa de valer. Só dispara em falta.

## Fora de escopo
- Não editar `src/lib/pedidos.ts` (mantém `REFACAO_*`), `src/lib/map.ts` (só importar), `cop-saldos.ts`, nem qualquer arquivo fora da lista.
- Nenhuma alteração de schema. Sem `DROP`/`TRUNCATE`/`DELETE` em massa.

Ao aprovar, executo os 4 blocos numa mesma sequência de edições.
