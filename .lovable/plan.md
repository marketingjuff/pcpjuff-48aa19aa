
# Plano — Ajustes MAP + PCP

Tudo será feito em uma leva. Nenhuma mudança destrutiva no banco — única migração é `ADD COLUMN observacoes text` em `map_producoes`.

---

## PARTE 1 — MAP

### 1.1 Coluna "KG RECEB." (`ProgramacaoFiosTab.tsx`)
- Renomear header "Kg solicitados" → "KG SOL.".
- Nova coluna "KG RECEB." logo depois, valor = `sumKgEntregas(byProdEntregas.get(prod.id) ?? [])`, formatação pt-BR até 2 casas, `tabular-nums`.
- Ajustar `<colgroup>` (redistribuir %) para caber sem scroll extra; se necessário reduzir header para `text-[10.5px]`.
- Vale para as duas abas (Programação e Finalizados) já que compartilham o mesmo componente.

### 1.2 JOKE / JUFF sempre maiúsculo (visual)
- Aplicar `className="uppercase"` (ou `.toUpperCase()` só no texto renderizado) onde "Joke"/"Juff" aparecem: coluna Empresa da tabela em `ProgramacaoFiosTab.tsx`, filtro Empresa (labels dos SelectItem), `NovoProdDialog` e `DevolucaoDialog`.
- **Sem** tocar em `value` dos SelectItem, inserts, filtros ou tipo `MapFaturar`.

### 1.3 Filtro Nota Fiscal busca em fio/malharia/tinturaria (`ProgramacaoFiosTab.tsx`)
- Mover a construção dos índices `byProdEntregas` / `byProdProgs` para **antes** do `useMemo` de `prods` (a partir de `entregasAll`/`progsAll`).
- Filtro `fNota` (case-insensitive, `includes`) considera match em qualquer:
  - `p.nota_fiscal`
  - `entrega.nota_fiscal_1` ou `entrega.nota_cobertura` de qualquer entrega do Prod
  - `prog.nota_fiscal_recebimento` de qualquer programação do Prod

### 1.4 Tinturaria: "+ Programação" direto, dropdown na linha (`TinturariaBlock.tsx`)
- Remover Select tinturaria + botão combo; ficar só o botão "+ Programação".
- Ao inserir, `tinturaria` = item da app_list `map_tinturaria` que bate com "Guararema" (case-insensitive); fallback: primeiro item; se lista vazia, string vazia (comportamento atual).
- Célula "Tinturaria" na tabela vira `<Select>` editável (opções da app_list), salvando via `commit(p, "tinturaria", v)`. Respeita `readOnly`. Valor legado aparece como opção extra.

### 1.5 Malharia: sai do NovoProdDialog, dropdown inline (`NovoProdDialog.tsx`, `MalhariaBlock.tsx`)
- **Remover** campo "Malharia (opcional)" (estado, reset, render) do `NovoProdDialog`.
- No insert de novo Prod: `malharia` = item da app_list `map_malharia` que bate com "Mavelo" (case-insensitive); fallback: primeiro item; lista vazia → `null`.
- Modo edição do dialog: **não** sobrescrever `malharia`.
- No `MalhariaBlock`, "Malharia: X" do cabeçalho vira `<Select>` inline (opções da app_list), salva via `patchProducao(producao.id, { malharia: v })` + `onChanged()`. Respeita `readOnly`. Legado como opção extra.

### 1.6 Fonte do cabeçalho Malharia (`MalhariaBlock.tsx`)
- Trocar `text-xs` → `text-sm` no enunciado do cabeçalho, igualando à Tinturaria.

### 1.7 Observações do Prod
- **Migração aditiva:**
  ```sql
  ALTER TABLE public.map_producoes ADD COLUMN observacoes text;
  ```
- Tipo `MapProducao` em `src/lib/map.ts`: adicionar `observacoes: string | null`.
- Em `ProgramacaoFiosTab.tsx`, na área expandida do Prod, **abaixo do `TinturariaBlock`**: `Textarea` rows=2 com label "Observações", `onBlur` chama `patchProducao(prod.id, { observacoes: v })` + toast discreto.
- Aba "Prod. Finalizados" (`readOnly`): exibe o mesmo campo somente-leitura.

### 1.8 Aba Finalizados completa
- Verificar `ProgramacaoFiosTab` em modo `readOnly=true`/`finalizado=true`: confirmar que entregas de malharia, programações de tinturaria, quebra/baixa e observações aparecem. Ajustar visibilidade condicional apenas se algum bloco estiver oculto na versão finalizada.

---

## PARTE 2 — PCP

### 2.1 Editor de refação em grade de tamanhos (`PecasPerdidasEditor.tsx`)
- Linha editável passa a ter: Modelo, Cor (trigger com `corHex`/negrito como hoje), e **um input numérico por tamanho** de `REFACAO_TAMANHOS` (label em cima, largura pequena, vazio/0 = ignorar).
- Formato JSONB **não muda**: ao confirmar linha, **expandir** para N entradas `{modelo, cor, tamanho, qtd}` (uma por tamanho com qtd≥1). Ao abrir para editar existente, **agrupar** por `modelo+cor` reconstruindo a grade.
- Validação: modelo + cor + ao menos 1 tamanho com qtd ≥ 1.
- `pecaLinhaCompleta`, `somaPecas`, `refacao-helpers.ts` continuam intactos.

### 2.2 Visualização agrupada
- `Chip` (read-only) em `PecasPerdidasEditor.tsx` agrupa entradas por `modelo+cor` e renderiza:
  `MODELO · [cor-badge] · PP:2 P:1 G:3 · Total 6`
  com o badge de cor usando `corHex` e texto via `corTextoSobre` (padrão atual).
- Como todos os consumidores (RefacaoViewerButton, RetrabalhoTab, SolicitarPecasDialog, RefacaoDialog) usam o mesmo `Chip`, a mudança fica centralizada. Verificar se algum consumidor renderiza chip próprio — se sim, ajustar para o mesmo formato.

---

## Arquivos a alterar
- `src/components/map/ProgramacaoFiosTab.tsx`
- `src/components/map/TinturariaBlock.tsx`
- `src/components/map/MalhariaBlock.tsx`
- `src/components/map/NovoProdDialog.tsx`
- `src/components/map/DevolucaoDialog.tsx` (apenas display JOKE/JUFF)
- `src/lib/map.ts` (adicionar campo `observacoes`)
- `src/components/pcp/PecasPerdidasEditor.tsx`
- Consumidores de chips de peças, só se renderizarem chip próprio
- 1 nova migração SQL (apenas `ADD COLUMN`)

## Fora do escopo (proibido)
- Qualquer mudança em COP, `cop-saldos.ts`, lógica de status MAP, `podeFinalizar`, constantes `REFACAO_*`, valores gravados de `faturar_para`, formato JSONB de `pecas_perdidas`/`refacoes`, ou qualquer DDL destrutiva.

Aprovar para eu executar tudo?
