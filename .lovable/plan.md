## Problema

No Dados In, o botão "Solicitar Peças" usa `limite = qtd do pedido` (200). Mas o pedido já teve 80 peças baixadas pelo COP (registradas em `pecas_completadas_log`). Ao tentar pedir 200, o usuário consegue chegar até 200 — quando deveria parar em 120 (200 − 80), pois 80 já foram entregues fisicamente.

## Correção

Em `src/components/pcp/DadosInTab.tsx` (linha 684), descontar do `limite` a soma das peças já completadas pelo COP no histórico:

```ts
const totalBaixado = (selected?.pecas_completadas_log ?? [])
  .reduce((a, l) => a + (Number(l.qtd) || 0), 0);
const qtdPedido = Number(form.qtd ?? selected?.qtd ?? 0) || 0;
limite={Math.max(0, qtdPedido - totalBaixado)}
```

Assim, com pedido de 200 e 80 já baixadas, o dialog limita novas solicitações a 120, mantendo a soma total (baixado + solicitado) ≤ qtd do pedido.

Nenhuma outra aba é tocada; a lógica de COP/Disponível permanece igual.