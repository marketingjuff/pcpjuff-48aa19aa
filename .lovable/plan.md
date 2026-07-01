## Fix — Disponível conta peças desde "Aguardando Risco"

### Problema

Hoje `calcEmProducao` em `src/lib/cop-saldos.ts` só soma COPs cujo status é diferente de "Aguardando Risco" e "Aguardando Corte". Resultado: um COP recém-criado, com peças salvas mas ainda sem datas de risco/corte, não aparece no Disponível.

### Comportamento desejado

Assim que o COP tem peças salvas, elas contam no Disponível — em qualquer etapa, incluindo "Aguardando Risco" e "Aguardando Corte".

### Alteração

`src/lib/cop-saldos.ts`

- Remover o filtro por status em `calcEmProducao`: passa a somar `pecas` de **todos** os COPs, exceto os já `Finalizado` ou com `pagamento_status = "pago"` (pra não poluir o quadro com COPs encerrados).
- `isCopEmProducao` fica marcado como `@deprecated` mas mantido (nenhum outro arquivo o usa segundo grep prévio; se aparecer uso, ajusto no mesmo passo).

Nenhuma outra parte do cálculo muda: `Disponível = produção − faltantes − recebido − perdas` continua valendo.

### Fora do escopo

- UI da aba Corte, botões de status, migração de dados.  
  
nao altere o banco de dados.