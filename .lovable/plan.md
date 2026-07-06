## Escopo

Adicionar ao MAP:
1. Lista gerenciável de **acabamentos** (`ACAB1`–`ACAB4` iniciais).
2. Card no config do MAP mapeando cada cor do PCP a um acabamento.
3. Na tabela de Tinturaria, trocar o input livre da coluna **Cor** por um dropdown que grava a string combinada `cor-ACABx` no momento da seleção.

Sem tocar em PCP, COP, `REFACAO_CORES`, `cop-saldos`, ou no schema de `map_tinturaria_programacoes`.

## 1. Migração (estritamente aditiva)

Novo arquivo: `supabase/migrations/<timestamp>_map_cor_acabamentos.sql`

```sql
-- Adiciona 'map_acabamento' ao check de app_lists (drop/recreate apenas do constraint)
ALTER TABLE public.app_lists DROP CONSTRAINT IF EXISTS app_lists_kind_check;
ALTER TABLE public.app_lists ADD CONSTRAINT app_lists_kind_check CHECK (kind = ANY (ARRAY[
  'vendedor','dtf','silk','acabamento','frete','pagamento','nf',
  'status_arte','corte_dtf','revelacao_silk','motivo_perda',
  'refacao_problema_arte','refacao_problema_dtf','refacao_problema_silk','refacao_problema_acabamento',
  'refacao_area_identifica','refacao_area_erro',
  'map_fio_fornecedor','map_malharia','map_tinturaria',
  'map_acabamento'
]));

-- Seed idempotente
INSERT INTO public.app_lists (kind, nome, ordem)
SELECT v.kind, v.nome, v.ordem
FROM (VALUES
  ('map_acabamento','ACAB1',10),
  ('map_acabamento','ACAB2',20),
  ('map_acabamento','ACAB3',30),
  ('map_acabamento','ACAB4',40)
) AS v(kind, nome, ordem)
WHERE NOT EXISTS (SELECT 1 FROM public.app_lists a WHERE a.kind = v.kind AND a.nome = v.nome);

-- Seed do mapa cor→acabamento em map_config
INSERT INTO public.map_config (key, value) VALUES ('cor_acabamentos', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;
```

Nenhuma tabela nova, nenhuma coluna nova, nenhuma alteração de policy/GRANT (já cobertas).

## 2. `src/lib/app-lists.ts`

Adicionar `"map_acabamento"` ao union `AppListKind`. Nada mais.

## 3. `src/lib/map.ts`

Adicionar, seguindo o padrão de `useKgPorPeca`:

- `useCorAcabamentos()` → lê `map_config` key `cor_acabamentos` (jsonb `Record<string,string>`, ex.: `{ "amarelo": "ACAB3" }`); mutation `save(mapaCompleto)` faz `upsert` com `updated_at`.
- Helper puro `corComAcabamento(nomeCor, mapa)` → retorna `"amarelo-ACAB3"` quando há acabamento; `"amarelo"` quando não há.

## 4. `src/components/map/MapConfigPanel.tsx`

- Novo `<ListaCard kind="map_acabamento" titulo="Acabamentos" placeholder="Ex.: ACAB5" />` (reusa componente atual sem alterá-lo).
- Novo `CoresAcabamentoCard` posicionado antes do `AcessoMapCard`:
  - Importa `REFACAO_CORES` de `@/lib/pedidos` (somente leitura).
  - Tabela: bolinha `hex` + nome da cor + `Select` shadcn com opções vindas de `useAppList("map_acabamento")` + opção "— sem acabamento" (remove a chave do mapa).
  - Coluna de prévia mostrando `corComAcabamento(nome, mapa)`.
  - `onValueChange` → `save.mutateAsync(mapaAtualizado)` com toast.
  - Texto explicativo: afeta apenas programações novas; registros existentes ficam intactos.

## 5. `src/components/map/TinturariaBlock.tsx`

Trocar o `InlineInput` da coluna **Cor** (linha 125) por um `Select` shadcn:

- Opções: `REFACAO_CORES` na ordem da constante; cada item exibe bolinha `hex` + rótulo já combinado via `corComAcabamento`.
- Opção "—" que grava `null`.
- Legado: se `p.cor` atual não existe entre as opções combinadas (ex.: `"Amarelo"`), renderizar como item selecionado extra sem apagar/normalizar; só muda se o usuário selecionar outra opção.
- Ao selecionar cor `X` com acabamento configurado `ACABy`, grava exatamente `"X-ACABy"` (ou `"X"` sem acabamento). Cadeia via `commit(p, "cor", valorCombinado)`.
- Respeitar `readOnly` desabilitando o Select.

## Comportamento congelado

O valor gravado em `map_tinturaria_programacoes.cor` é a string do momento da seleção. Mudar o config depois **não** reescreve linhas antigas. Nada de recomputar sufixo dinamicamente na exibição.

## Fora de escopo (proibições)

- Não editar `src/lib/pedidos.ts`, `src/lib/cop*.ts`, `src/lib/cop-saldos.ts`, `src/components/pcp/**`, `src/components/cop/**`.
- Não modificar `ListaCard` nem outros cards existentes do config.
- Não criar tabela/coluna nova em `map_tinturaria_programacoes`.

## Critérios de aceitação

1. Card "Acabamentos" no config com ACAB1–ACAB4, add/remove funcionando.
2. Card de cores lista todas as cores do PCP com bolinha, dropdown de acabamento e prévia; persiste após reload.
3. Coluna Cor da Tinturaria virou dropdown com sufixo do acabamento; grava string combinada visível após reload.
4. Alterar acabamento no config não altera linhas já gravadas.
5. Programações antigas com texto livre continuam intactas.
6. PCP/COP com zero diffs; build TS limpo.
