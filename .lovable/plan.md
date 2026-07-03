# Plano de implementação — COP + PCP

Confirmei a estrutura real dos arquivos listados. Nada será tocado fora do escopo. Migração: **nenhuma** (PCP-1 é só na aplicação).

---

## PARTE 1 — COP

### COP-1 · `DisponivelTab.tsx` — zebra em vez de cor da linha

- Remover `const rowBg = ...` e `style={{ backgroundColor: rowBg }}` da `<tr>` (linha ~171).
- Adicionar `className={i % 2 ? "bg-muted/40" : ""}` na `<tr>` (preservando `border-t-2` do separador de grupo e `hover:bg-muted/60`).
- **Manter** o badge de cor na primeira coluna intacto.

### COP-2 · Padronizar badge de cor no COP inteiro (`text-xs font-bold`)

Aplicar o padrão canônico (`inline-block px-2 py-0.5 rounded text-xs font-bold` + `backgroundColor: corHex(cor)` + `color: corTextoSobre(...)`) em todos os pontos que hoje renderizam a cor:

- `DisponivelTab.tsx` (badge da coluna cor) — adicionar `font-bold`.
- `FaltaPorPedidoTab.tsx` (linha ~313) — subir `text-[10px]` → `text-xs font-bold`, `px-1 py-0` → `px-2 py-0.5`. **Remover qualquer fundo colorido da linha/célula** (verificar `style` na `<tr>`/`<td>` que use `hex` fora do badge).
- `PagamentoOficinasTab.tsx` (~298) — `text-xs` → `text-xs font-bold`.
- `PerdasTab.tsx` (~213, ~255) — idem `font-bold`.
- `RomaneioTab.tsx` (~533) — idem `font-bold`.
- Também: `RegistrarPerdaDialog`, `ParticionarRomaneioDialog`, `BaixaCopDialog`, `FaltaPecaPopup`, `EntregaRomaneioDialog`, `DivisaoCorteDialog`, `OficinasHojeTab` — só adicionar `font-bold` no badge de cor (nenhuma outra mudança).
- Não mexer em `corHex`/`corTextoSobre`.

### COP-3 · `CorteTab.tsx` — nova tabela inferior

Substituir colunas da tabela de "COPs" por, nesta ordem:

1. **Número do COP** (`formatCopNumero`, marca "(filho)" quando `cop_pai_id`).
2. **Status** (badge `etapaStyle`).
3. **Oficina** — reaproveitar a query `["oficinas"]` já usada em `RomaneioTab`; `oficinas.find(o => o.id === c.oficina_id)?.nome ?? "—"`.
4. **Resumo das peças** — agrupar `c.pecas` por `modelo+cor`, somar tamanhos; render: `Modelo <badge cor bold>Cor</badge> (qtd) · …`. Truncar com `line-clamp-2` mas garantir 2 grupos.

- **Remover** colunas Solic. Risco, Exec. Corte e o botão "Abrir".
- Clique na `<tr>` → `setSelectedId(c.id)` + auto-scroll (COP-5).

### COP-4 · `RomaneioTab.tsx` — mesma reestruturação

Ordem das colunas:

1. **Romaneio** (`rotuloRomaneio(c, cops)`).
2. **Status**.
3. **Oficina** (já existe query; `—` se null).
4. **Resumo das peças** — mesmo formato do Corte, prefixado com `**Nx pçs ·**`  (total numérico das peças do romaneio) para não perder a informação de total.
5. **Recebimento** (`c.data_recebimento ?? "—"`).

- **Consolidação proposta** (preciso do seu OK): as colunas atuais **Peças**, **Recebido** e **Saída** somem — total de peças vira o prefixo `Nx pçs` do resumo; **Recebimento** vira a coluna 5; **Saída** deixa de aparecer aqui (segue visível no editor de cima).
- Remover botão "Abrir".

### COP-5 · Auto-scroll ao clicar em linha

Padrão do PCP (`DadosInTab` usa `scrollIntoView`):

- `CorteTab`: criar `editorRef` no topo do bloco do editor; no `onClick` da linha, após `setSelectedId`, `editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })`.
- `RomaneioTab`: idem.
- Só onde há editor acima (Corte e Romaneio). Botões "Abrir" removidos.

### COP-6 · Filtros e ordenação

- **Corte**: adicionar filtro de **oficina** (Select com "Todas", "Sem oficina", + oficinas cadastradas), mesmo padrão do Romaneio. Manter status + busca.
- **Romaneio**: manter os 3 filtros existentes.
- Em ambas: cabeçalhos das colunas **Número/Romaneio, Status, Oficina, Recebimento (Romaneio)** viram botões que alternam asc/desc, com indicador `▲/▼`. Ordenação num `useMemo` sobre a lista filtrada.

---

## PARTE 2 — PCP

### PCP-1 · Reuso de número Olist após deletar

**Investigação (do plano):** o `checkDuplicado` em `DadosInTab.tsx` usa `.eq("pedido_olist", …).maybeSingle()`. Se houver >1 registro com o mesmo Olist (ex.: um finalizado + tentativa nova), o `maybeSingle` retorna erro do PostgREST → o código assume "duplicado" e bloqueia. Como o `remove` no `_authenticated/index.tsx` faz `DELETE` físico, um número já deletado deveria estar liberado — o bug está no `checkDuplicado`, não no `remove`. Não há necessidade de nova coluna. **Não vou checar/alterar constraint no banco** — se ao rodar detectarmos unique index em `pedido_olist`, paro e pergunto.

**Mudanças:**

- Em `DadosInTab.tsx > checkDuplicado`: trocar `maybeSingle()` por `.select("id, finalizado_em, pedido_olist")` (retorna array), e:
  - Se algum registro tiver `finalizado_em != null` → bloqueia com msg **"Número Olist já foi utilizado por um pedido finalizado."**
  - Se houver algum ativo com `id !== currentId` → bloqueia com **"Já existe um pedido ativo com esse número Olist."**
  - Caso contrário → libera.
- Nenhuma mudança na `remove` do `_authenticated/index.tsx` (o DELETE físico já cobre).

### PCP-2 · `RetrabalhoTab.tsx` — "Área que mais errou" + gráficos

- Calcular `areasErroRank` análogo ao `areasIdRank`, contando `e.area_erro` nos episódios (ignora vazios).
- Novo card **"Área que mais errou"** ao lado de "Área que mais identifica"; valor = `areasErroRank[0]?.[0] ?? "—"`.
- Criar componente local `RankingBarDialog({ title, open, onOpenChange, entries })` com `BarChart` do recharts (eixo X = área, eixo Y = contagem). Se `entries.length === 0` → mensagem "Sem dados".
- Ambos os cards abrem esse dialog (converter o dialog de lista atual do "Área que mais identifica" para gráfico).

### PCP-3 · Botão "Passar pra frente / Já realizado" em DTF+Silk em refação

- Helper novo em `refacao-helpers.ts`:
  ```
  restaurarEtapaDoHistorico(pedido, etapa: "dtf" | "silk"): Record<string, any> | null
  ```
  Lê `episodioAberto(p).retrato?.campos_apagados` e devolve apenas as chaves da etapa correspondente (usando `WIPE_DTF` / `WIPE_SILK` de `pedidos.ts`). Retorna `null` se não houver histórico.
- Condições para exibir o botão (nas duas abas):
  1. `tipoIncluiDTF(p.tipo_estampa) && tipoIncluiSilk(p.tipo_estampa)`
  2. `episodioAberto(p)` verdadeiro
  3. `restaurarEtapaDoHistorico(p, "dtf" | "silk") !== null`
- `DTFTab.tsx`: botão **"Já realizado — passar pra frente"**. Ao clicar:
  - Merge dos campos restaurados no estado do form.
  - Append em `dtf_observacao`: `\nAproveitado do histórico em DD/MM/AAAA`.
  - Dispara o `save` existente (mesma via de conclusão da etapa) → fluxo segue.
- `SilkTab.tsx`: idêntico com `silk_observacao` e chaves de `WIPE_SILK`.
- Sem alterar `camposAlimpar` nem cálculo de etapa. Backward compat: sem `campos_apagados` → botão não aparece.

---

## Pontos que preciso confirmar antes de implementar

1. **COP-4:** OK com consolidar Peças+Recebido+Saída no formato `Nx pçs · Modelo Cor (qtd) · …` + coluna final `Recebimento`? (Alternativa: manter uma coluna `Peças` numérica separada.)
2. **COP-6:** Ordenação — inclui também a coluna "Resumo das peças"? (Sugiro **não**, ordena por total de peças só se você pedir.)
3. **PCP-3:** O rótulo do botão fica **"Já realizado — passar pra frente"**? Alguma preferência de cor (default `secondary`)? ->Somente Já realizado

Aguardo seu OK (ou ajustes) para começar.