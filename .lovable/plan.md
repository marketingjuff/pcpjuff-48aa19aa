# Ajustes de KPI e rótulos de refação (fluxo Humberto)

Sem migração de banco. Apenas os 5 arquivos do allowlist.

## 1. `src/lib/kpi-pcp.ts`

- `interface SituacaoAgora` (linha 448): filas passam a aceitar `titulo?: string` e `apoio?: string` (opcionais).
- `situacaoAgora` (linha ~476): a linha única "Em Expedição" vira três, na ordem:
  - "Em Expedição" — mantida exatamente como hoje (`etapa(p) === "Aguardando Expedição"`), sem título/apoio.
  - "Saiu para entrega" — título "Pedidos na rua — Humberto", apoio "Saíram com o Humberto e ainda não tiveram a entrega confirmada."
  - "Entregue" — título "Entregues aguardando finalização", apoio "O Humberto já confirmou a entrega, mas a expedição ainda não finalizou o pedido."
- `conta` (só abertos) e `etapa()` (remove asteriscos) não mudam.

## 2. `src/components/kpi/KpiPcpTab.tsx`

No Bloco 5 ("Situação de agora"), o `.map` das filas usa `f.titulo ?? \`Pedidos parados — ${f.rotulo}\`` e `f.apoio ?? "Pedidos abertos nessa fila agora."`. Componente `Kpi`, cards de atrasados/vencendo/idade média e a nota de rodapé ficam intactos.

## 3. Mapas de rótulo de etapa (3 arquivos)

Em `src/components/pcp/refacao-helpers.ts` (`ORIGEM_LABEL`), `src/components/pcp/RetrabalhoTab.tsx` e `src/components/pcp/RefacaoViewerButton.tsx` (`ETAPA_LABEL_MAP`), adicionar logo após `"Aguardando Expedição"`:

```ts
"Saiu para entrega": "Saiu para entrega",
"Entregue": "Entregue",
```

Nenhuma outra chave, função de lookup ou lógica muda.

## Não muda

`src/lib/pedidos.ts`, `ExpedicaoTab.tsx`, `FreteTab.tsx`, rota `/entregas`, `cop-saldos.ts`, COP/MAP/SUP, cores, `supabase/migrations/`.
