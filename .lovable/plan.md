## Plano: Cor editável para o botão "Reabrir"

### O que será feito
Adicionar o botão **"Reabrir"** (da aba Finalizados) ao sistema de configuração de cores, permitindo que administradores editem sua cor via a aba **Cores** em Configurações.

### Arquivos e mudanças

1. **src/hooks/use-color-settings.ts**
   - Adicionar `"reabrir"` ao tipo `BotaoKey`.
   - Adicionar cor padrão para `reabrir`: fundo `#FF8C2F`, texto `#FFFFFF`.
   - Atualizar o `mergeSettings` para incluir a nova chave.

2. **src/components/pcp/FinalizadosTab.tsx**
   - Importar `useColorSettings` / `btnStyle`.
   - Aplicar `btnStyle('reabrir')` nos dois botões "Reabrir" (mobile e desktop), substituindo o `variant="outline"` atual.

3. **src/routes/_authenticated/configuracoes.tsx**
   - Adicionar o botão "Reabrir" à lista editável na aba **Cores**, seguindo o mesmo padrão dos botões "Atualizar", "Finalizar" e "Voltar".

### Não será alterado
- Lógica de refação, abas de setores, tabelas do banco ou migrações. Somente a aparência do botão e sua configuração na tela de cores.