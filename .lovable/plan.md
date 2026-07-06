## Plano: Corrigir sinal do cálculo da quebra no MAP

### Problema
O usuário reportou que o valor da quebra está com o sinal invertido: onde deveria ser positivo está negativo, e vice-versa.

### Diagnóstico
A função `calcQuebra` em `src/lib/map.ts` (linha 72-74) calcula:
```ts
return Number(prod.kg_solicitados ?? 0) - sumKgEntregas(entregas);
```

Isso resulta em:
- **Positivo** quando o recebido é **menor** que o solicitado (falta material).
- **Negativo** quando o recebido é **maior** que o solicitado (sobra material).

O usuário quer o **oposto**.

### Alteração
1. **Inverter a ordem da subtração** em `src/lib/map.ts`:
   ```ts
   return sumKgEntregas(entregas) - Number(prod.kg_solicitados ?? 0);
   ```
   
   Resultado esperado:
   - **Negativo** quando recebeu menos que solicitado (quebra = deficit).
   - **Positivo** quando recebeu mais que solicitado (quebra = excesso).

### Escopo
- Apenas a função `calcQuebra` em `src/lib/map.ts`.
- Nenhuma mudança em banco de dados, migrações, ou outros componentes.
- O `MalhariaBlock.tsx` exibe o valor retornado por `calcQuebra` sem lógica adicional de sinal, então a correção é transparente para a UI.
