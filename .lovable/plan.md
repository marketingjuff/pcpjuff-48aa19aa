## Problema

O pedido #1 (Olist `1`) está com `expedicao_entrou_em` preenchido, `embalado = "Sim"` e ainda não foi finalizado. Ele aparece corretamente em todas as abas (Expedição, etc.), mas **somem do Dashboard Master**.

## Causa

Em `src/components/pcp/DashboardTab.tsx`, a função `pedidoEmEtapa` filtra por `pedidoAtivoNasAreas(p)` antes de qualquer coisa. Em `src/lib/pedidos.ts`, `pedidoAtivoNasAreas` retorna `false` quando `expedicao_entrou_em` está setado (e o pedido não está `reaberto`). Resultado:

- Cards de stats: o card "Expedição" usa `emExpedicao(p)` (`embalado === "Sim" && !finalizado_em`) → conta o pedido 1 corretamente.
- Tabela: o filtro de etapa rejeita o pedido 1 em **todas as etapas** (inclusive `expedicao` e `ativas`), porque `pedidoAtivoNasAreas` corta antes.

Inconsistência: o número do card diz "1", mas clicar abre uma tabela vazia, e o pedido nunca aparece no Master.

## Correção (apenas `src/components/pcp/DashboardTab.tsx`)

Ajustar `pedidoEmEtapa` para que pedidos em expedição (não finalizados) sejam tratados como ativos:

```ts
function pedidoEmEtapa(p: Pedido, e: Etapa): boolean {
  if (e === "finalizados") return !!p.finalizado_em;

  const ativoNormal = pedidoAtivoNasAreas(p);
  const ativoExpedicao = emExpedicao(p); // embalado===Sim && !finalizado_em
  const ativo = ativoNormal || ativoExpedicao;
  if (!ativo) return false;

  if (e === "todas" || e === "ativas") return true;
  if (e === "expedicao") return ativoExpedicao;

  // demais etapas continuam usando o label calculado
  const etapaAtual = calcularEtapaAtual(p).etapa.replace(/\*$/, "");
  const map = { /* inalterado */ };
  return map[e]?.includes(etapaAtual) ?? false;
}
```

Com isso:
- O pedido 1 aparece em "Total ativos" e ao clicar no card "Expedição".
- O comportamento das outras abas (Silk, Arte, DTF, Dados In, Acabamento, Expedição, Finalizados) permanece inalterado — esse ajuste está restrito ao Dashboard Master.
- Nenhuma mudança em `pedidos.ts` ou na regra global `pedidoAtivoNasAreas` (usada em outros lugares).

## Arquivos alterados

- `src/components/pcp/DashboardTab.tsx` — ajuste em `pedidoEmEtapa`.
