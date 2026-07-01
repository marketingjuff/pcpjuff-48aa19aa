## Ajuste: Permitir datas iguais entre Início de Acabamento, Término de Acabamento e Saída Juff

### Problema
O usuário relatou erro ao salvar um pedido quando `inicio_acabamento`, `termino_acabamento` e `saida_juff` possuem a mesma data. A validação atual em `DadosInTab.tsx` parece usar `>` (permitindo igualdade) na maioria das comparações, mas o erro persiste — indicando que pode haver outro ponto de validação (outro componente, helper ou verificação de dia útil) bloqueando.

### Passos
1. **Reproduzir e identificar**: Usar o preview para simular o salvamento com datas iguais e capturar a mensagem de erro exata (toast ou console).
2. **Corrigir a validação**: Após identificar o ponto exato do bloqueio, ajustar a comparação de datas para permitir igualdade (`>=` ou `<=` no lugar de `>` ou `<` onde aplicável).
3. **Verificar consistência**: Garantir que nenhuma outra aba (`AcabamentoTab`, `ExpedicaoTab`, etc.) contenha validação cruzada que impeça a igualdade.
4. **Testar**: Confirmar no preview que o pedido salva corretamente com as três datas iguais.

### Nota técnica
A comparação de datas já normaliza para `YYYY-MM-DD` (slice) e usa `>`, o que teoricamente permite igualdade. O erro pode estar em uma validação de dia útil (`isDataUtilISO`) aplicada a `saida_juff` ou em algum helper não revisado.