Plano para corrigir o cálculo do Disponível no COP:

1. Alterar somente `src/lib/cop-saldos.ts`
   - Reescrever `calcBaixado` para somar todo o `pecas_completadas_log` de todos os pedidos.
   - Remover a dependência de `pecas_solicitadas` / `solicitadosAtuais`.
   - Manter a validação de quantidade positiva (`qtd > 0`).

2. Não alterar o banco de dados
   - Sem migration.
   - Sem alteração de tabela, trigger, policy ou dados existentes.
   - Sem `DROP`, `DELETE`, `TRUNCATE` ou qualquer operação destrutiva.

3. Não mexer no fluxo de gravação da baixa
   - `FaltaPorPedidoTab.tsx` já grava `qtd_enviada` e `pecas_completadas_log`.
   - `BaixaCopDialog.tsx` fica igual.
   - `DisponivelTab.tsx` fica igual e refletirá o cálculo corrigido automaticamente.

4. Resultado esperado
   - Fórmula continua: `Disponível = Produção − Faltantes − Baixado`.
   - Após baixa total, o `Faltantes` cai, mas o `Baixado` permanece descontando.
   - A peça baixada não volta ao disponível; o disponível só aumenta com novo corte/romaneio.