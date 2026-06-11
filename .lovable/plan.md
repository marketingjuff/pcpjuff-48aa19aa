## Objetivo

1. Tornar editáveis as listas de Vendedores, Operadores DTF, Operadores Silk e Responsáveis pelo Acabamento via Painel de Configurações.
2. Bloquear os dropdowns de responsável enquanto a data vinculada estiver vazia, e limpar o valor automaticamente ao reverter (apagar a data).
3. Garantir que o campo Vendedor nunca venha pré-selecionado, mesmo após salvar e depois reverter.

---

## 1. Banco — nova tabela `app_lists`

Migration única (com GRANTs + RLS):

```sql
CREATE TABLE public.app_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('vendedor','dtf','silk','acabamento')),
  nome text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_lists TO authenticated;
GRANT ALL ON public.app_lists TO service_role;
ALTER TABLE public.app_lists ENABLE ROW LEVEL SECURITY;

-- Todos os autenticados leem (dropdowns)
CREATE POLICY app_lists_select_auth ON public.app_lists
  FOR SELECT TO authenticated USING (true);

-- Apenas admin/gestor escrevem
CREATE POLICY app_lists_write_admin ON public.app_lists
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

CREATE TRIGGER app_lists_updated_at BEFORE UPDATE ON public.app_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

Seed com os valores hard-coded atuais (Wander/Mirela/Gabriel; Jefferson/Sarah/Rubens; Gleisson/Marcelo; Vanessa/Patrícia/Juliana) + "Outros".

---

## 2. Hook `useAppList`

Novo `src/lib/app-lists.ts`:
- `useAppList(kind)` → `useQuery(["app-lists", kind])` lendo `app_lists` ordenado por `ordem, nome`. Retorna `string[]` de nomes.
- Helpers `addItem`, `renameItem`, `deleteItem` (mutations) com `invalidateQueries`.

---

## 3. Configurações — nova aba "Listas"

Em `src/routes/_authenticated/configuracoes.tsx`:
- Adicionar `<TabsTrigger value="listas">Listas</TabsTrigger>` (visível a admin e gestor).
- Novo componente `ListasTab` que renderiza 4 cards (Vendedores, Operadores DTF, Operadores Silk, Responsáveis pelo Acabamento). Cada card: input + botão Adicionar, tabela com nome editável inline e botão excluir. Confirmação ao excluir.

---

## 4. Substituir constantes hard-coded pelos hooks

Arquivos afetados:
- `DadosInTab.tsx`: dropdown Vendedor consome `useAppList("vendedor")`.
- `DTFTab.tsx`: "Quem bateu o DTF?" consome `useAppList("dtf")`.
- `SilkTab.tsx`: "Quem bateu o Silk?" consome `useAppList("silk")`.
- `AcabamentoTab.tsx`: "Responsável" consome `useAppList("acabamento")`.
- `DashboardTab.tsx` (filtro Vendedor): também consome `useAppList("vendedor")`.

As constantes em `pedidos.ts` permanecem apenas para retrocompat de outros pontos não-dropdown (ou são removidas se não usadas).

---

## 5. Bloqueio + reversão automática dos dropdowns de responsável

Regra: o select de responsável é `disabled` quando a data vinculada está vazia, e ao limpar a data o valor do responsável vai a `null` no mesmo `set`.

- **DTFTab**: helper `set("dtf_data_executada", v)` passa a também zerar `quem_bateu_dtf` quando `v` for vazio. `Select` recebe `disabled={!form.dtf_data_executada}`.
- **SilkTab**: idem com `silk_data_executada` → `quem_bateu_silk`.
- **AcabamentoTab**: trocar o gate atual (`embalado === "Sim"`) por `acabamento_data`. Ao limpar `acabamento_data`, zerar `responsavel_acabamento`. `Select` recebe `disabled={!form.acabamento_data}`.

Isso garante o comportamento de reversão pedido (campo fica em branco se a data for apagada).

---

## 6. Vendedor — nunca pré-selecionar

Em `DadosInTab.tsx`:
- `initialForm` remove `vendedor: "Wander"` (passa a `vendedor: null`).
- O `<Select value={form.vendedor ?? ""} ...>` já mostra o placeholder "Selecione..." quando vazio — confirmar `SelectValue placeholder="Selecione..."`.
- Ao reverter (limpar) um pedido salvo, o form recebe `null` e o placeholder reaparece — nenhum fallback para o primeiro item da lista.

---

## Arquivos afetados

- migration nova (app_lists + seed)
- `src/lib/app-lists.ts` (novo)
- `src/routes/_authenticated/configuracoes.tsx`
- `src/components/pcp/DadosInTab.tsx`
- `src/components/pcp/DTFTab.tsx`
- `src/components/pcp/SilkTab.tsx`
- `src/components/pcp/AcabamentoTab.tsx`
- `src/components/pcp/DashboardTab.tsx`
