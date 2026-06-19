Plano único para a aba **Acabamento** (Blocos 1–4) e ordenação nas demais abas (Bloco 5). Sem novos arquivos. Sem alterar lógica fora do escopo.

## Bloco 1 — Topo da aba Acabamento (read-only)
`AcabamentoTab.tsx`, grid dos `ReadOnlyField`:
- Remover **Data de Entrega**.
- Adicionar **Início de Acabamento** (`inicio_acabamento`) e **Término de Acabamento** (`termino_acabamento`) via `ReadOnlyField` + `formatDateBR`.
- Reorganizar em duas linhas (grids separados):
  - **Linha 1** (`sm:grid-cols-3 lg:grid-cols-6`): Pedido · Orçamento · Tipo de Estampa · Status de Peças · DTF Estampado? · Silk Estampado?
  - **Linha 2** (`sm:grid-cols-2 lg:grid-cols-3`): Início de Acabamento · Término de Acabamento · Saída Juff (prazo)
- Bloco do **Layout** (download + `AcabamentoVoltar`) permanece logo abaixo das duas linhas, igual hoje.

## Bloco 2 — Bloco de edição
`AcabamentoTab.tsx`, grid dos `FormField`:
- **EMBALADO?** permanece igual.
- Renomear rótulo `"Data Saída Juff"` → **"Data da Embalagem"** (asterisco quando `embalado === "Sim"`). Coluna do banco continua `data_saida_juff`. Comportamento atual de `setEmbalado`/`setDataSaida` preservado (auto-preenche `todayISO()` ao marcar Sim; limpa ao voltar para Não).
- **Responsável pelo Acabamento (múltiplos)** e **Observações** permanecem.

## Bloco 3 — Envio automático para Expedição
`AcabamentoTab.tsx`, função `handleSave`:
- Trocar condição `embalado === "Sim" && !selected.expedicao_entrou_em` por:
  `embalado === "Sim" && !!data_saida_juff && !!responsavel_acabamento && !selected.expedicao_entrou_em` (usando os valores do `payload`).
- Banner verde: trocar o texto para  
  > "Pronto para Expedição. Ao clicar em **Atualizar Acabamento**, o pedido vai automaticamente para a Expedição."

  (O `podeFinalizar` já exige os três campos, então o banner aparece nas condições corretas.)
- Texto auxiliar abaixo do botão ("Ao salvar com EMBALADO=Sim…") permanece — só descreve o fluxo.

## Bloco 4 — Dashboard do Acabamento
`AcabamentoTab.tsx`, tabela desktop + cards mobile:
- **Tipo do `useSort`**: trocar para `useSort<"pedido"|"qtd"|"inicio"|"termino"|"saida">()`.
- **Colunas finais (ordem)**: ETAPA · PEDIDO · ORÇAMENTO · TIPO · QTD · STATUS DAS PEÇAS · DTF EST. · SILK EST. · INÍCIO ACAB. · TÉRMINO ACAB. · SAÍDA JUFF (11 colunas; `colSpan` da linha vazia = 11).
- Remover **EMBALADO**, **RESPONSÁVEL** e **ENTREGA**.
- Tornar ordenáveis com `SortableTh`:
  - **PEDIDO**: numérico por `Number(p.pedido_olist)`, com NaN/null por último. Helper inline `cmpPedido(a, b, dir)`.
  - **QTD**: `cmpNum(qtd)`.
  - **INÍCIO ACAB.**: `cmpDate(inicio_acabamento)`.
  - **TÉRMINO ACAB.**: `cmpDate(termino_acabamento)`.
  - **SAÍDA JUFF**: `cmpDate(saida_juff)`.
- Estender o `switch (sort.key)` para `pedido | qtd | inicio | termino | saida`.
- **Mobile cards**: remover chips "Embalado" e "Entrega"; adicionar "Início Acab.", "Término Acab." e "Saída Juff" (`formatDateBR`).

## Bloco 5 — Ordenação nas demais abas
Padrão: helper local `cmpPedido` (numérico, não-numérico/null por último) em cada arquivo; estender o `useSort` e o `switch` correspondente. Não mexer no Dashboard Master.

- **ArteTab.tsx**: tornar **PEDIDO** e **INÍCIO EST.** ordenáveis. Estender `useSort` para `"pedido"|"qtd"|"entrada"|"limite"|"saida"|"inicio"` e adicionar `cmpPedido` + `cmpDate(arte_data)` no switch.
- **DTFTab.tsx**: tornar **PEDIDO**, **INÍCIO ESTAMPARIA**, **TÉRMINO ESTAMPARIA** e **INÍCIO ACABAMENTO** ordenáveis. Estender `useSort` para `"pedido"|"qtd"|"exec"|"saida"|"entrega"|"iniEst"|"fimEst"|"iniAcab"`. Campos a confirmar lendo a tabela: `dtf_inicio` / `dtf_termino` / `inicio_acabamento` (usar os já mostrados nas células).
- **SilkTab.tsx**: idem DTF, com os campos `silk_inicio` / `silk_termino` / `inicio_acabamento`.
- **DadosInTab.tsx**: tornar **PEDIDO** ordenável (numérico). Estender `useSort` (`"pedido"|...`) e o switch. Demais (QTD, Tempo Frete, Entrada, Saída, Entrega) já ordenam.
- **ExpedicaoTab.tsx**: substituir o `Th` fixo de **PEDIDO** por `SortableTh` (numérico). O sort atual usa estado próprio (`sortKey: "saida_juff" | "data_entrega"`); estender para incluir `"pedido"` no `sortKey`/`toggleSort` e no `useMemo` do `dashboardPedidos` (ramo numérico via `Number`).
- **FinalizadosTab.tsx**: tornar **PEDIDO** ordenável. Estender `useSort` para `"pedido"|"qtd"|"saida"|"data_saida"|"fin"` e o switch com `cmpPedido`.

## Notas técnicas
- Helper `cmpPedido` (definido em cada arquivo, sem novo módulo):
  ```ts
  function cmpPedido(a: Pedido, b: Pedido, dir: "asc"|"desc") {
    const na = Number(a.pedido_olist), nb = Number(b.pedido_olist);
    const aBad = !Number.isFinite(na), bBad = !Number.isFinite(nb);
    if (aBad && bBad) return 0;
    if (aBad) return 1;
    if (bBad) return -1;
    return dir === "asc" ? na - nb : nb - na;
  }
  ```
- Nenhuma migração, nenhum tipo novo. Só renderização e ordenação.
- Antes de tocar nos campos `dtf_inicio/termino`, `silk_inicio/termino` nos blocos DTF/Silk, abro os arquivos para confirmar os nomes exatos das colunas usadas nas células e reuso esses mesmos identificadores no `switch`.
