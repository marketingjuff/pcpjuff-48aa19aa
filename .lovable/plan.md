Vou separar o salvamento da aba Dados In em dois fluxos independentes:

1. **Input do Vendedor**
  - Adicionar um botão próprio dentro do card “Input do Vendedor”.
  - Esse botão vai validar somente os campos obrigatórios do vendedor: Pedido Olist, Orçamento, Quantidade, Vendedor e Entrada do pedido.
  - Ele poderá criar ou atualizar o pedido sem exigir Status Geral ou Tipo de Estampa.
  - sinalizar quais campos obrigatorios nao foram preenchidos.
2. **Input de Produção**
  - Adicionar um botão próprio dentro do card “Input de Produção”.
  - Esse botão vai validar somente os campos obrigatórios de produção: Status Geral e Tipo de Estampa.
  - Para salvar produção, ele exigirá que o pedido já exista ou que os dados mínimos do vendedor necessários para criar o pedido também estejam presentes.
  - sinalizar quais campos obrigatorios nao foram preenchidos.
3. **Remover o salvamento único do final do formulário**
  - Retirar o botão único “Salvar/Atualizar” que hoje mistura as duas áreas.
  - Evitar que uma área bloqueie o salvamento da outra.
4. **Ajustar o atalho/salvamento global da aba**
  - O salvamento registrado para a aba Dados In passará a salvar o Input do Vendedor por padrão, para não travar por causa dos campos de produção.