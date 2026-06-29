# Reabilitar "Solicitar Peças" após voltar para Incompleto

## Problema

Quando o COP dá baixa total das peças, `pecas_solicitadas` fica com `qtd_enviada == qtd` para todas as linhas. Mesmo trocando `status_pecas` para "incompleto" no Dados In e salvando, o botão continua aparecendo como **"Pedido Completo"** (readOnly), pois `tudoEnviado` ainda é `true` — impedindo uma nova solicitação ao COP.

## Solução

Em `src/components/pcp/DadosInTab.tsx`, no fluxo de salvar do Dados In:

- Se o usuário definiu `status_pecas = "incompleto"` e a solicitação atual está toda enviada (`tudoEnviado`), limpar `pecas_solicitadas: []` ao salvar.
- O histórico de baixas (`pecas_completadas_log`) permanece intocado, então o registro no COP/Disponível continua íntegro.
- Resultado: ao reabrir o pedido, o botão volta a renderizar como **"Solicitar Peças"** (não readOnly) e o usuário pode montar uma nova solicitação.
- Entretanto a soma da solicitacao de peças precisa respeitar a quantidade de peças do pedido para nao gerar inconsistencias. 

Nenhuma outra aba ou tabela é tocada.