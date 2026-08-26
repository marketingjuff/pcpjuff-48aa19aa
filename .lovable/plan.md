# COP · Aba Corte · Campo "Quem cortou" (lista configurável)

Arquivo por arquivo, seguindo a allowlist do prompt. Nada fora dela.

## 1. Nova migração em `supabase/migrations/`
Somente aditiva:
- `ALTER TABLE public.cops ADD COLUMN IF NOT EXISTS quem_cortou text NULL;`
- `INSERT` idempotente em `app_lists` de `cop_cortador` com `Bruno` (10) e `Lucas` (20).

Sem `DROP`, sem `DELETE`, sem tocar em `app_lists_kind_check`.

## 2. `src/lib/app-lists.ts`
Acrescentar `"cop_cortador"` ao union `AppListKind`. Nada mais.

## 3. `src/lib/config-listas-catalogo.ts`
Novo item no `LISTAS_CATALOGO`, seção COP, grupo "Corte", título
"Quem cortou o tecido" — aparece sozinho em Configurações > COP.

## 4. `src/lib/cop.ts`
No tipo `Cop`, abaixo de `execucao_corte`: `quem_cortou: string | null;`.
`calcularStatusCorte` intocado.

## 5. `src/lib/audit-labels.ts`
Na seção cop: `quem_cortou: "Quem cortou"`.

## 6. `src/components/cop/CorteTab.tsx`
- Importar `MultiSelectPeople` / `parsePeople` do PCP e `useAppList`.
- `const { names: cortadores } = useAppList("cop_cortador")`.
- Incluir `quem_cortou` no `setDraft` do COP selecionado.
- Fileira de datas passa a `md:grid-cols-5`; campo "Quem cortou" entre
  "Solicitação do Corte" e "Execução do Corte", desabilitado por
  `bloqueado || emCorrecao`.
- Helper `faltaCortador()`: bloqueia `handleAtualizar` (ramo normal) e
  `handleMandarRomaneio` com toast de erro quando há data de execução do
  corte sem nome selecionado.
- Persistir `quem_cortou` nos dois payloads de salvamento.
- `handleDivisao`: COP filho nasce sem `quem_cortou`.

## Não tocado
`cop-saldos.ts`, `admin.functions.ts`, `schema-extras.ts`, arquivos do PCP,
`configuracoes.tsx`, PDF do romaneio, Dashboard COP.

## Ao final
Rodo o typecheck e mostro o resultado.
