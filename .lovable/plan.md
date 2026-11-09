# Monitor PCP — confirmação ao arrastar

## Objetivo
Exigir confirmação antes de deslocar as datas de um pedido pelo arrasto no Monitor PCP, mantendo todos os cálculos e o tratamento atual de conflitos.

## Arquivo de aplicação autorizado
### `src/components/pcp/monitor/MonitorPcpTab.tsx`
1. Importar os oito elementos de `AlertDialog` especificados; suas exportações já foram conferidas.
2. Adicionar `arrastoPendente`, contendo o pedido e o deslocamento em dias úteis.
3. Renomear a função atual `arrastar` para `executarArrasto`, preservando exatamente seu corpo: leitura, bloqueio por etapa, cálculo das datas, conflitos e gravação final.
4. Criar a nova `arrastar`, sem gravação: respeitar somente leitura, manter o aviso de etapa executada, ignorar deslocamento zero e guardar o arrasto para confirmação. Manter `onArrastar={arrastar}` e `podeArrastar={!soLeitura}`.
5. Calcular as datas exibidas com os mesmos `addDiasUteis` e `feriados`, mostrando somente campos preenchidos, na ordem Arte, Início da estamparia, Término da estamparia e Término do acabamento. Usar `formatDateBR` nas datas atuais e propostas.
6. Renderizar junto aos diálogos existentes:
   - Título: **Confirmar alteração de datas**.
   - Identificação: `Pedido #{pedido_olist} ({qtd} pçs)`.
   - Uma linha por campo com a data atual `para` a nova data.
   - Rodapé: `Todas as datas do pedido serão movidas juntas.`
   - **Cancelar**: limpar o estado pendente, sem executar ou salvar.
   - **Confirmar alteração**: executar o arrasto original e depois limpar o estado pendente.
7. Fechar por Esc ou clique fora com o mesmo efeito de Cancelar. O AlertDialog existente bloqueia clique fora por padrão; acrescentar tratamento local somente neste arquivo, com referência ao conteúdo e escuta de clique externo enquanto aberto, removida ao fechar. Não modificar o componente compartilhado.

## Comportamentos preservados
- O Gantt já limpa o deslocamento visual ao soltar; cancelar mantém a posição original sem qualquer ajuste adicional.
- Após confirmar, conflitos de prazo ou vídeo continuam abrindo o `EditarDatasDialog`, sem unificar os dois diálogos.
- O botão lateral **Editar datas** continua abrindo diretamente o diálogo atual.
- Nenhuma mudança no restante do texto, cores, ícones ou layout do Monitor.
- Nenhuma migração, coluna nova ou alteração no banco.
- Nenhum arquivo de aplicação fora da allowlist será criado, alterado ou removido, incluindo os cinco arquivos protegidos.

## Validação
- Conferir que o corpo de `executarArrasto` permaneceu idêntico ao original e que não existe gravação na nova `arrastar` nem nos caminhos de cancelamento.
- Usar verificações temporárias fora do projeto para exercitar confirmação, cancelamento, deslocamento zero, somente leitura, bloqueio de etapa e encaminhamento de conflitos, sem criar arquivos de teste no projeto fora da allowlist.
- Conferir na tela abertura, datas e fechamento por Cancelar, Esc e clique fora, quando houver sessão e pedido elegível, sem confirmar uma gravação real. Nenhuma verificação gravará dados de produção.
- Conferir a checagem automática de tipos/compilação e apresentar o resultado antes de concluir; não rodar manualmente a compilação do projeto.
- Conferir que apenas o arquivo de aplicação autorizado foi alterado.

## Aprovação
A implementação começará somente após sua aprovação explícita deste plano.