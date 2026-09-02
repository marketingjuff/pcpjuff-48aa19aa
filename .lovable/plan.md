# Corrigir o botão "Mover para Custom" que não aparece no pop-up

O recurso já está implementado (tabela de exceções no banco, mutação e coluna no pop-up), mas o botão nunca aparece por causa de um detalhe de nome de campo: o pop-up de pedidos identifica o número do pedido na coluna chamada `pedido`, enquanto a verificação que liga a ação procura por `numero_pedido`. Como nunca encontra, a coluna "Escopo" é omitida em todos os detalhamentos.

## Correção

- Ajustar a condição que decide se o detalhamento aceita a ação de escopo para procurar a coluna `pedido`.
- Ajustar a chave passada para o pop-up (`chaveNumero`) para `pedido`, de modo que o botão leia o número correto de cada linha.

## Resultado esperado

1. KPI → aba **KPI Juff Store** → clicar em qualquer valor de pedidos/faturamento/peças (vendedor, empresa, cliente, mês) abre o pop-up com a coluna **Escopo** à direita e o botão **"Mover para Custom"** por linha.
2. Na aba **KPI Juff Custom**, os pedidos que a regra automática classificaria como Store mostram **"Voltar para Store"**, permitindo desfazer.
3. Um clique salva a exceção no banco, os dois painéis se recalculam e aparece um aviso de confirmação.
4. Somente admin e gestor veem o botão; para os demais o pop-up segue somente leitura.

## Verificação

Depois do ajuste, abrir o pop-up de um vendedor na aba Juff Store no preview e confirmar visualmente a coluna e o botão, além de rodar a build.
