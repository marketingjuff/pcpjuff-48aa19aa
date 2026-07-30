# MAP — Devolução por peça (Estoque de MP → Devoluções → retorno corrigido)

Substitui a devolução por lote (dentro do PROD) por devolução **por peça**, nascendo no Estoque de MP, com ciclo de correção (retingir/retrabalhar) e retorno ao estoque.

## 1. Migration (aditiva)

Duas partes, nada de DROP TABLE / DELETE / TRUNCATE / rename.

**a) Colunas novas em `map_estoque_pecas`:**

```sql
ALTER TABLE public.map_estoque_pecas
  ADD COLUMN IF NOT EXISTS devolucao_motivo text,
  ADD COLUMN IF NOT EXISTS devolucao_data date,
  ADD COLUMN IF NOT EXISTS devolucao_nf text,
  ADD COLUMN IF NOT EXISTS correcao_tipo text,
  ADD COLUMN IF NOT EXISTS correcao_status text,
  ADD COLUMN IF NOT EXISTS cor_nova text,
  ADD COLUMN IF NOT EXISTS historico_correcoes jsonb NOT NULL DEFAULT '[]'::jsonb;
```

**b) CHECK de `app_lists.kind` — lista copiada do banco (`pg_get_constraintdef`), apenas com `'map_motivo_devolucao'` acrescentado ao final:**

```sql
ALTER TABLE public.app_lists DROP CONSTRAINT app_lists_kind_check;
ALTER TABLE public.app_lists ADD CONSTRAINT app_lists_kind_check CHECK (kind = ANY (ARRAY[
  'vendedor','dtf','silk','acabamento','frete','pagamento','nf',
  'status_arte','corte_dtf','revelacao_silk','motivo_perda',
  'refacao_problema_arte','refacao_problema_dtf','refacao_problema_silk','refacao_problema_acabamento',
  'refacao_area_identifica','refacao_area_erro',
  'map_fio_fornecedor','map_malharia','map_tinturaria','map_acabamento',
  'destino_perda','map_motivo_devolucao'
]));

INSERT INTO public.app_lists (kind, nome, ordem) VALUES
  ('map_motivo_devolucao','cor errada',10),
  ('map_motivo_devolucao','mancha',20),
  ('map_motivo_devolucao','acabamento',30);
```

O CHECK de `map_estoque_pecas.status` já contém `'Devolvida'` e não será tocado. Nenhuma RLS nova (políticas de `map_estoque_pecas` e `app_lists` já cobrem).

## 2. Estoque de MP (`EstoqueMpTab.tsx`)

- Coluna de checkbox (primeira, estreita). Habilitado só para `Fechada`, ou `Aberta` sem nenhum corte. Peça com corte: desabilitado + tooltip "Peça com corte não pode ser devolvida".
- Botão **"Devolver selecionadas (N)"** ao lado dos filtros quando houver seleção.
- `pecasFiltradas` passa a excluir também `status === 'Devolvida'`.
- Select de status da linha: opção `Devolvida` removida (exibida como item legado desabilitado se a peça já estiver nesse status).
- Cards por cor: peça `Devolvida` sem correção conta em **Devolvida**; peça com `correcao_status` preenchido sai de Devolvida e conta em **Produção**, na cor base de `cor_nova`. Total (Fechada+Aberta+Corte) inalterado.

## 3. Novos diálogos

- **`DevolverPecasDialog.tsx`** — data única (hoje), NF opcional, lista de peças com select de motivo obrigatório por peça (`useAppList('map_motivo_devolucao')`). Confirma → por peça: `status='Devolvida'` + campos de devolução + append em `historico_correcoes` (`tipo:'devolucao'` com dados antigos).
- **`CorrigirPecaDialog.tsx`** — Retingir (select de cor no padrão `REFACAO_CORES` + `corComAcabamento`, cor atual pré-selecionada) ou Retrabalhar. Grava `correcao_tipo`, `correcao_status`, `cor_nova` + append `correcao_iniciada`.
- **`ReceberPecaCorrigidaDialog.tsx`** — novo nº da peça, nova NF, nova data (obrigatórios). Append `retorno` no histórico; aplica `numero_peca`/`nota_fiscal`/`data_entrada` novos, `cor = cor_nova`, `status='Fechada'`, `data_abertura=null`, limpa campos de devolução/correção. Mantém `alt_inicial`, `larg`, `ne`, PROD.

Todos os appends leem o array atual e concatenam (append-only) e invalidam `["map","estoque_pecas"]`.

## 4. Aba Devoluções (`DevolucoesTab.tsx`, reescrita)

Passa a ler `map_estoque_pecas` com `status='Devolvida'` (não lê mais `map_devolucoes`; a tabela fica intacta no banco).

Colunas: NE · PROD · Nº peça · Cor atual · Motivo · Data devolução · NF devolução (inline editável) · Situação · Ações.
Situação: `Devolvida` (âmbar) · `Aguardando retingir → <cor nova>` · `Em retrabalho`. Filtro por situação + contador, cabeçalho congelado (`tbl-congelada`, `max-h-[70vh]`).
Ações: **Corrigir** (quando sem correção) e **Receber peça retingida/retrabalhada** (quando em correção). Ícone de histórico abre popup somente leitura do `historico_correcoes` (mais recente primeiro).

## 5. PROD

- `ProgramacaoFiosTab.tsx`: remover botão "Devolução", estado `devProd`, uso e import de `DevolucaoDialog`. O arquivo `DevolucaoDialog.tsx` permanece no repo, sem uso.
- `TinturariaBlock.tsx` (`ReceiptDot`): condição "preto" cobre também peças com `correcao_status` preenchido; dot vira Popover listando `NE · nº peça · motivo · situação`.

## 6. Configurações e tipos

- `app-lists.ts`: adicionar `"map_motivo_devolucao"` ao `AppListKind`.
- `MapConfigPanel.tsx`: editor "Motivos de devolução" no padrão dos demais.
- `map.ts`: estender `MapEstoquePeca` com os campos novos + tipos `CorrecaoTipo`, `CorrecaoStatus`, `HistoricoCorrecaoEvento`.

## Fora de escopo

`cop-saldos.ts`, `DevolucaoDialog.tsx`, tabela `map_devolucoes` e suas policies, CHECK de status, `inventario-pdf.ts`, qualquer arquivo de COP ou PCP.
