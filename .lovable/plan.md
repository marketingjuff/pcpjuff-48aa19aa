Você tem razão: a correção anterior ficou incompleta. Ela ignorou apenas pedidos sem nenhuma solicitação atual, mas ainda contou logs antigos quando o pedido tinha solicitação atual de outro item. Por isso o item “preto” continua aparecendo com baixado, mesmo com o popup dizendo “Nenhum pedido pede este item”.

Plano de correção:

1. Ajustar a regra do `Baixado` no COP
   - Contar `pecas_completadas_log` somente quando existir uma peça atual em `pecas_solicitadas` com o mesmo:
     - modelo
     - cor
     - tamanho
   - Se o log antigo não tiver mais solicitação atual correspondente, ele será ignorado no saldo.

2. Manter a proteção contra o bug original
   - Pedidos finalizados/completos que ainda mantêm a solicitação atual do item continuarão abatendo do Disponível.
   - Apenas logs “órfãos”/antigos/teste, sem item atual correspondente, deixarão de aparecer.

3. Atualizar as telas que usam esse cálculo automaticamente
   - Aba Disponível
   - Dashboard COP / saldo negativo
   - Popup de detalhe do item

4. Validar com o caso da imagem
   - Conferir que “preto” não aparece mais quando não há pedido atual pedindo esse item.
   - Conferir que o popup não mostra mais `Baixado: 8` sem pedido correspondente.

Observação: não vou apagar dados do banco; será só correção da lógica de leitura/cálculo para ignorar logs antigos sem solicitação atual correspondente.