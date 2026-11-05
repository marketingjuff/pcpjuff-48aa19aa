# Sob demanda para todos os tamanhos de uma cor

## Resultado

Adicionar **Sob demanda** ao lado de **Copiar/Colar** na faixa de cada cor. Um clique marca todos os tamanhos daquela cor no mesmo modelo, sem alterar os mínimos adotados. Manter os botões individuais por tamanho.

Quando todos os tamanhos estiverem marcados, o botão será **Voltar ao normal**, permitindo desmarcar a cor inteira. Se apenas alguns estiverem marcados, **Sob demanda** completa a marcação dos restantes.

## Arquivos

### `src/lib/plan.ts`
- Estender a gravação de Sob demanda para receber um lote de linhas, mantendo o caminho individual existente.
- Ler os valores atuais e preservar mínimo, sugerido na adoção e dados de adoção. Linhas ainda sem registro recebem mínimo zero, conforme a regra existente.
- Gravar o lote em uma única operação e atualizar as consultas existentes. Não alterar banco, permissões, cálculos ou pausas.

### `src/components/plan/EstoqueMinimoTab.tsx`
- Adicionar o botão pequeno na faixa de cor, ao lado de Copiar/Colar, somente para quem já pode editar.
- Aplicar a todos os tamanhos existentes daquele modelo/cor, incluindo os ocultos pelo filtro de defasados, sem atingir outras cores ou modelos.
- Bloquear novos cliques durante a gravação e mostrar erros na mensagem existente da tela.
- Preservar Copiar/Colar, números adotados, Tab e botões individuais.

### `src/lib/plan-estoque-minimo.test.ts`
- Acrescentar testes do lote: todos os tamanhos da cor, estado parcialmente marcado, preservação dos valores e exclusão de outras cores/modelos.

## Verificação

Executar os testes e conferir a checagem automática. Na tela, conferir o botão ao lado de Copiar/Colar, marcar e desmarcar uma cor inteira, recarregar para confirmar persistência e verificar que os números não mudaram.

Aguardar aprovação antes de alterar código.