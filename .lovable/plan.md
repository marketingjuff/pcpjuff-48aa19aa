# Corrigir peças zeradas na Venda real — KPI Juff Store

## Causa confirmada
Nos pedidos 17287, 17289, 17292 e 17317, a peça tem preço importado de R$ 109,90 e desconto do pedido de R$ 109,90: a venda líquida é R$ 0,00. O filtro atual compara R$ 109,90 com o limite de R$ 20,00 antes de considerar o desconto do pedido. Por isso mantém essas peças como venda real.

A lista da imagem é o detalhe da faixa principal, que deve continuar mostrando o total, inclusive vouchers; a segunda faixa está incorreta por usar a base de comparação anterior ao desconto.

## Correção proposta
Usar o preço líquido por peça após o rateio do desconto do pedido para comparar com o limite de voucher. O valor unitário importado já contém desconto de item: não descontá-lo novamente.

### Arquivos de implementação
1. **`src/lib/indicadores-store.ts`**: em `resumoSemVoucher`, classificar cada peça usando `(subtotal do item − desconto do pedido proporcional ao item) / quantidade`. Manter o mesmo rateio e somas existentes, sem aplicar desconto duas vezes. Item abaixo do limite fica fora; item exatamente no limite continua real. Pedido sem peça real sai das contagens, ticket e frete da segunda faixa. Quantidade não positiva não pode fazer um pedido contar como venda real.
2. **`src/components/kpi/IndicadoresTab.tsx`**: ajustar somente a explicação da segunda faixa para informar que o limite considera o desconto proporcional do pedido.

## Preservar
Faixa principal, detalhe da imagem, Frete existente, Juff Custom, composição, rankings, filtros, tabelas e PDFs. Não criar detalhamento novo. Não alterar pedidos, importações, configurações salvas, permissões ou estrutura do banco.

## Verificação
- Reproduzir o caso R$ 109,90 com desconto R$ 109,90: zero peças e pedidos reais, uma peça e um pedido excluídos.
- Conferir pedidos mistos, desconto proporcional, preço exatamente R$ 20,00, serviços e ausência de desconto duplicado.
- Executar testes temporários fora do repositório, conforme a restrição anterior, sem deixar arquivos temporários no projeto.
- Conferir outubro/2026 na tela autenticada e os resultados da compilação automática; informar qualquer limitação da verificação de tipos.

## Aprovação
Esta correção muda a base do filtro aprovado anteriormente (de preço importado para preço líquido após desconto de pedido). A implementação aguarda aprovação deste plano.
