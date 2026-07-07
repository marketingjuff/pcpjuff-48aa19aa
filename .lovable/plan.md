## MAP — Rodada completa (Estoque, Quebra, Devoluções + ajustes em Fios)

Regra de banco: **somente aditivo** (CREATE TABLE, CREATE POLICY, GRANT). Nada de DROP/TRUNCATE/DELETE/rename.

---

### FASE 1 — Migration `map_devolucoes` (nova, aditiva)

Nova migration em `supabase/migrations/`, espelhando as policies de `map_producoes` (área `map` via `has_area` + admin):

```sql
CREATE TABLE IF NOT EXISTS public.map_devolucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producao_id uuid NOT NULL REFERENCES public.map_producoes(id),
  nota_fiscal text NOT NULL,
  cor text NOT NULL,
  pecas numeric NOT NULL,
  kg numeric NOT NULL,
  faturado_para text NOT NULL,          -- 'Joke' | 'Juff'
  data_devolucao date NOT NULL DEFAULT current_date,
  obs text,
  status text NOT NULL DEFAULT 'em_andamento',  -- 'em_andamento' | 'finalizada'
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  finalizada_em timestamptz,
  finalizada_por uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_devolucoes TO authenticated;
GRANT ALL ON public.map_devolucoes TO service_role;

ALTER TABLE public.map_devolucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "map_select" ON public.map_devolucoes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));
CREATE POLICY "map_insert" ON public.map_devolucoes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));
CREATE POLICY "map_update" ON public.map_devolucoes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));
CREATE POLICY "map_delete" ON public.map_devolucoes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_area(auth.uid(),'map'));

CREATE INDEX IF NOT EXISTS map_devolucoes_prod_idx   ON public.map_devolucoes (producao_id);
CREATE INDEX IF NOT EXISTS map_devolucoes_status_idx ON public.map_devolucoes (status);
```

---

### FASE 2 — Componentes novos (`src/components/map/`)

**2.1 `EstoqueMpTab.tsx`** — já existe como placeholder; manter como está.

**2.2 `QuebraTab.tsx`** (novo)
- Fonte: `useMapData(false)` → `producoes` + `entregas` agrupadas por `producao_id` (mesmo `byProdEntregas` do `ProgramacaoFiosTab`).
- Por PROD: `calcQuebra(prod, entregasDoProd)`; `quebraKg` / `quebraPecas` replicando **exatamente** o cálculo que o `MalhariaBlock` faz ao instanciar `BaixaQuebraDialog` (ler o arquivo e copiar).
- Colunas: Prod (`prodCode(numero)`), Empresa, Fornecedor, Kg solicitados, Kg recebidos (`sumKgEntregas`), Quebra (kg), Status (badge Conciliada verde / Pendente âmbar), Ação.
- Filtro: Pendente / Conciliada / Todas (default Pendente).
- Ação: abre o `BaixaQuebraDialog` existente (pendente) ou desfaz via `patchProducao(id, { quebra_conciliada:false, quebra_conciliada_em:null, quebra_conciliada_por:null, quebra_conciliacao_obs:null })` — mesmo padrão do `MalhariaBlock`.

**2.3 `DevolucaoDialog.tsx`** (novo)
- Props: `producao`, `programacoes` (do PROD), `open`, `onOpenChange`, `onDone`.
- Campos:
  - **Nota fiscal**: dropdown com valores distintos e não-vazios de `nota_fiscal_recebimento` das programações do PROD.
  - **Cor**: dropdown das cores distintas das programações cuja `nota_fiscal_recebimento` = NF selecionada.
  - **Data**: date input, default hoje.
  - **Peças / Kg**: numéricos. Teto por (NF+cor):
    - `maxPecas = Σ pecas_recebidas nas programações da NF+cor − Σ pecas já em map_devolucoes desse PROD+NF+cor`
    - `maxKg` = idem com `kg_recebidos` vs `kg`.
    - Bloqueia submit quando excede; exibe mensagem.
  - **Empresa faturada**: dropdown Joke/Juff, default `prod.faturar_para`.
  - **Obs**: opcional.
- Ao salvar: INSERT em `map_devolucoes` com `status='em_andamento'`, `created_by = auth.user.id`. Não altera nenhuma outra tabela.

**2.4 `DevolucoesTab.tsx`** (novo)
- Query react-query em `map_devolucoes` (padrão dos demais hooks); mapear PROD via `map_producoes` já carregado.
- Colunas: Prod, NF, Cor, Peças, Kg, Faturado para, Data, Status.
- Filtro: Em andamento / Finalizadas / Todas (default Em andamento).
- Ações: **Finalizar** (`update status='finalizada', finalizada_em=now(), finalizada_por=uid`) e **Reabrir** (`status='em_andamento', finalizada_em=null, finalizada_por=null`).
- Visual amarelo do MAP.

---

### FASE 3 — `src/routes/_authenticated/map.tsx`

- Adicionar imports de `QuebraTab` e `DevolucoesTab` (o de `EstoqueMpTab` já existe).
- Array `TABS` final:
  ```
  programacao · finalizados · estoque · quebra · devoluções
  ```
- Adicionar apenas os `TabsContent` de `quebra` e `devolucoes` (o de `estoque` já foi adicionado); manter os existentes intactos.

---

### FASE 4 — `src/components/map/ProgramacaoFiosTab.tsx` (ajustes cirúrgicos)

- **4.1** Célula da coluna Empresa: adicionar `font-bold` ao `<td>` que renderiza `prod.faturar_para`.
- **4.2** Célula de ações do PROD: adicionar botão `Devolução` (`variant="outline" size="sm"`) que abre `DevolucaoDialog` com `producao={prod}` e programações do PROD (`byProdProgs[prod.id]`).
- Nada mais é alterado.

---

### Proibições reafirmadas

- Não tocar em `src/lib/map.ts`, `MalhariaBlock.tsx`, `TinturariaBlock.tsx`, `BaixaQuebraDialog.tsx`, `FiosFinalizadosTab.tsx`, `useCanAccessMap`.
- Não subtrair de `map_tinturaria_programacoes` nem `map_malharia_entregas` — recebido é só teto de validação.
- Nenhum DROP/TRUNCATE/DELETE/rename.

### Detalhes técnicos

- `map_devolucoes` fica fora de `types.ts` (auto-gen); usar `(supabase as any).from("map_devolucoes")` como já é feito com as outras tabelas MAP em `src/lib/map.ts`.
- `created_by` / `finalizada_por` populados via `supabase.auth.getUser()`.
- Query keys: `["map","devolucoes"]`; invalidar após insert/update.

Aguardo "ok" para executar nesta ordem: (1) migration, (2) componentes, (3) map.tsx, (4) ProgramacaoFiosTab.
