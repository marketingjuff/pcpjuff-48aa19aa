O aviso "As alterações não foram salvas" que aparece ao trocar de abas na tela principal (`/`) está mais atrapalhando que ajudando. Vamos removê-lo.

Alterações em `src/routes/_authenticated/index.tsx`:

1. Simplificar `requestTab(next)` para trocar de aba imediatamente, sem verificar `isDirty`.
2. Simplificar `requestLogout()` para chamar `handleLogout()` diretamente.
3. Simplificar `requestSettings()` para retornar `true` sempre.
4. Simplificar `goToTabWithPedido(t, id)` para apenas selecionar o pedido e trocar de aba.
5. Remover o estado `pendingNav`, a função `performPending` e o bloco JSX do `<AlertDialog>` (título "Tem certeza que deseja sair?" e descrição "As alterações não foram salvas.").
6. Remover a importação do `useDirtyForm` deste componente (manter o `<DirtyFormProvider>` no `AppHome` para não quebrar os hooks das abas filhas).
7. Simplificar o botão de Configurações no header para navegar diretamente sem verificação.

Nenhum outro arquivo precisa ser alterado. O contexto `DirtyFormProvider` continua existindo para as abas filhas, mas a tela principal não mais bloqueia a navegação com base nele.