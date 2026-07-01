## Ajuste no popup da aba Disponível (COP)

No popup que abre ao clicar numa peça na aba **Disponível**, os campos de falta ainda aparecem em positivo. Ajustar para apresentação negativa quando houver falta.

### Arquivo
`src/components/cop/DisponivelTab.tsx` (bloco do Dialog, linhas ~234–270)

### Mudanças

1. **Cabeçalho "Faltantes"** (linha 237):
   - Se `falt > 0`, exibir como `-{falt}` em vermelho (`text-red-700 font-bold`) em vez de `{falt}` em âmbar.
   - Se `falt === 0`, manter `0` neutro.

2. **Coluna "Falta" da tabela por pedido** (linha 265):
   - Se `falta > 0`, exibir `-{falta}` em vermelho e negrito.
   - Se `falta === 0`, exibir `0` neutro (sem verde).

3. Não alterar Produção, Baixado nem Saldo (Saldo já mostra negativo corretamente).
4. Nenhuma mudança de lógica de cálculo — apenas apresentação visual.