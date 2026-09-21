# COP — Romaneio da oficina interna Juff vai direto para Pago

Sem migração e sem alteração de schema. Apenas 2 arquivos: `src/lib/cop.ts` e `src/components/cop/RomaneioTab.tsx`. O SQL de regularização só roda depois da sua aprovação por escrito.

## 1. `src/lib/cop.ts` — helper de oficina interna

Acrescentar, junto aos helpers já exportados (sem mexer em nenhuma função existente):

- `export const OFICINA_INTERNA_NOME = "juff";`
- `export function isOficinaInterna(oficina?: { nome?: string | null } | null): boolean` — normaliza NFD, remove acentos, `trim()`, `toLowerCase()` e compara com `OFICINA_INTERNA_NOME`. `true` para `Juff`, `juff`, `JUFF`, ` Juff `; `false` para `Juff 2`, `Oficina Juff`, `null`, `undefined`, vazio.

## 2. `src/components/cop/RomaneioTab.tsx` — `handleConferir`

- Adicionar `isOficinaInterna` ao import já existente de `@/lib/cop`.
- Em `handleConferir` (linha ~604), após a checagem de `completo` e o `supabase.auth.getUser()`, usar o `oficina` já resolvido no componente (`oficinas.find((o) => o.id === selected?.oficina_id)`, linha ~111) e bifurcar:
  - **Oficina externa (inalterado):** `salvar.mutateAsync` com `status: "Aguardando Pagamento"`, `conferido_em`, `conferido_por`. Nenhum campo de pagamento tocado.
  - **Oficina interna Juff (novo):** uma única `salvar.mutateAsync` com `status: "Finalizado"`, `conferido_em`, `conferido_por`, `pagamento_status: "pago"`, `pagamento_valor_calculado: 0`, `pagamento_liberado_em`/`pagamento_liberado_por`, `pagamento_pago_em`/`pagamento_pago_por` (todos com o mesmo timestamp e usuário).
- Nenhuma RPC (`liberar_pagamento_cop`, `marcar_pagamento_cop`) é chamada. Update direto pela mutation `salvar` já existente.
- `setSelectedId(null)` mantido nos dois caminhos.

### Toast

- Externa: texto atual mantido — `Romaneio ${rotulo} foi para Pagamentos e saiu da lista de romaneios ativos.`
- Juff: `Romaneio ${rotulo} é da oficina Juff, foi direto para Pago com valor zero e já está Finalizado.`

### Aviso antes do clique

Imediatamente acima do botão "Mandar pro pagamento" (linha ~1306), quando a oficina for a interna, um `div className="text-xs text-muted-foreground"` com:
`Oficina interna Juff. Ao mandar pro pagamento, este romaneio vai direto para Pago com valor zero.`
Sem componente, ícone ou card novo. Rótulo do botão e condições de exibição (`completoTotal || status === "Romaneio Completo"` e a troca por "Conferido em" via `conferido_em`) idênticas.

## 3. Regularização dos romaneios Juff pendentes

Dois passos, na ordem:

- **Passo A (somente leitura):** rodo o SELECT de conferência exatamente como está na especificação (filtro por `lower(btrim(o.nome)) = 'juff'`, `pagamento_status <> 'pago'`, status em `Aguardando Pagamento`/`Finalizado`) e te mostro a lista e a contagem. **Paro aqui.**
- **Passo B (só após sua aprovação por escrito):** o UPDATE autorizado, letra por letra como na especificação, alterando somente as 5 colunas listadas. Depois rodo o SELECT do Passo A de novo, que precisa vir vazio.

Se o Passo A trouxer zero linhas, o Passo B não roda e eu te aviso. `Romaneio Completo` fica de fora de propósito. Nenhum `delete`, `drop`, `truncate` ou segundo update.

## O que não muda

`PagamentoOficinasTab.tsx`, `PagamentoConsolidadoCard.tsx`, `HistoricoPagamentosConsolidados.tsx`, `cop-saldos.ts`, `cop-oficinas.ts`, `admin.functions.ts`, `schema-extras.ts`, `types.ts`, `supabase/migrations/`. Particionamento, perdas, "Voltar para o Corte", refação, Oficinas Hoje, Dashboard e Histórico COP intactos.

## Ao final

Typecheck (`bunx tsgo --noEmit`) e diff resumido por arquivo para conferir que só os 2 arquivos da allowlist foram tocados.
