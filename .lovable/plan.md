# PCP: reabrir solicitação de peças quando o pedido já está completo

Hoje, quando tudo o que foi pedido ao COP já foi entregue, o botão vira "Pedido Completo (14/14)" e o dialog abre somente-leitura — não há caminho para registrar que faltaram mais peças depois. A solução mantém **um único lugar** para dizer o que falta: o dialog de peças, que passa a ser sempre editável.

Sem migração. Nenhum arquivo fora dos três abaixo é tocado.

## 1. `src/components/pcp/DadosInTab.tsx`

- Remover `readOnly={tudoEnviado}` do `<SolicitarPecasDialog>` (sempre editável). Botão e contador continuam iguais.
- Passar `limiteApenasAviso={temBaixaRegistrada}`, onde `temBaixaRegistrada` = existe algum item em `pecas_completadas_log`. Assim um pedido de 14 com 14 entregues aceita pedir mais 4 (total 18) sem travar no limite do vendedor.
- Em `salvarPecasSolicitadas`, após o merge atual, calcular a pendência (`qtd - qtd_enviada` somada). Se houver pendência, gravar também `status_pecas: "incompleto"` no `setForm` e no `onSave` — é o que faz a falta reaparecer nas telas do COP.
- Passar `onEditarPecas={() => setSolicitarOpen(true)}` e `onAfterSave` ao `<PecasCompletadasPanel>`; o `onAfterSave` aplica o patch no `form` local para o select "Status de Peças" e o contador do botão refletirem na hora.
- Nada muda em `resetPecas`, validação de datas ou outros campos.

## 2. `src/components/pcp/SolicitarPecasDialog.tsx`

Nova prop opcional `limiteApenasAviso` (default `false` — comportamento atual intacto). Quando `true`:

- a digitação de quantidade não é mais capada pelo limite;
- o botão Salvar não é desabilitado por excesso (e o `handleSave` não aborta);
- a mensagem de excesso vira aviso amarelo: "Total acima da quantidade do vendedor (N) — permitido porque este pedido já teve peças entregues pelo COP."

Resto do dialog inalterado.

## 3. `src/components/pcp/PecasCompletadasPanel.tsx`

Painel passa a ser somente leitura + duas ações:

- **Lápis**: deixa de abrir input inline; chama `onEditarPecas?.()` (abre o dialog de peças). Título: "Editar peças do pedido".
- **Seta**: comportamento e `AlertDialog` de confirmação atuais preservados (reverte a baixa, recalcula enviadas, volta o pedido para `incompleto`); ao final chama `onAfterSave?.()` com os valores gravados.
- Remover estados e funções de edição inline (`editIdx`, `editQtd`, `editObs`, `iniciarEdicao`, `cancelarEdicao`, `confirmarEdicao`) e os botões Check/X. A mutation `salvar` continua, servindo ao reverter. `recomputeEnviadas` e `statusPecas` intocados.
- Observação do item continua visível, só não editável. Legenda passa a "Lápis abre a edição de peças; seta reverte a baixa."

## Notas técnicas

- Colunas usadas: `pedidos.pecas_solicitadas`, `pedidos.pecas_completadas_log`, `pedidos.status_pecas`.
- `src/lib/cop-saldos.ts`, `cop.ts`, `pedidos.ts` e componentes de COP/MAP permanecem intactos.
- Pedido em primeira solicitação (sem nenhuma baixa) mantém o bloqueio de limite do vendedor como hoje.
