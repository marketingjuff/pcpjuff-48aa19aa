# Secagem zero no Silk — produção no mesmo dia

## Objetivo
Permitir que pedidos Silk (ou DTF+Silk) com `dias_secagem = 0` tenham o Início de Acabamento no mesmo dia do Término de Estamparia, viabilizando pedidos de emergência produzidos inteiramente no mesmo dia.

## Arquivo alterado (único)
`src/lib/pcp-monitor.ts`

### `calcInicioAcabamento` (linhas 31-45)
No ramo em que `incluiSilk` é verdadeiro:
- Se `diasSecagemNum <= 0`: retornar `termino_estamparia` diretamente, sem `addDiasCorridos` e sem `proximoDiaUtil` (mesmo comportamento do caso "só DTF").
- Se `diasSecagemNum > 0`: manter exatamente a fórmula atual (`término + N + 1` dia corrido, depois `proximoDiaUtil`).

Assinatura, ordem de parâmetros e tipo de retorno permanecem inalterados.

### Comentários
- Atualizar o JSDoc da função e o comentário inline acima do cálculo para documentar a regra da secagem zero.

### `inicioAcabamentoDoPedido`
Nenhuma mudança — herda o novo comportamento.

## Fora do escopo
- Nenhuma migração de banco, nenhuma alteração de tabela/coluna.
- Nenhum outro arquivo tocado (COP, MAP, SUP, KPI, `DadosInTab.tsx`, `EditarDatasDialog.tsx`, `MonitorPcpTab.tsx`, `GanttPedidos.tsx`, `cop-saldos.ts`).

## Verificação
- Silk + `dias_secagem = 0`, término 14/08/2026 → início 14/08/2026.
- Silk + `dias_secagem = 2`, término 14/08/2026 → início 17/08/2026 (sem regressão).
- Só DTF → retorna o término; "Lisa" ou sem término → `null`.
