# Plano: Adicionar 2 modelos à lista REFACAO_MODELOS

## Alteração proposta

No arquivo `src/lib/pedidos.ts`, adicionar dois itens ao **final** do array `REFACAO_MODELOS`, sem tocar em nenhum outro arquivo ou constante.

### Estado final do array

```typescript
export const REFACAO_MODELOS = [
  "Camiseta", "Baby Look", "Regata Masculina", "Regata Feminina",
  "ML Masculina", "ML Feminina", "Camiseta Infantil", "ML Infantil",
  "Regata Cross", "Regata Wing", "Regata Move",
  "ML Hide Masculina", "ML Hide Feminina", "ML Hide Infantil",
  "Regata Breeze", "Não Identificado",
] as const;
```

## O que não será alterado

- Nenhum item existente será renomeado, reordenado ou removido.
- Nenhuma outra constante do arquivo (`REFACAO_CORES`, `REFACAO_TAMANHOS`, `cmpModelo`, etc.) será modificada.
- Nenhum outro arquivo do projeto será alterado.
- Nenhuma migration ou alteração de banco de dados será executada.

## Resultado esperado

Os modelos "Regata Breeze" e "Não Identificado" passarão a aparecer automaticamente em todos os seletores de modelo que consomem `REFACAO_MODELOS` (PCP e COP), posicionados por último na ordem de corte.
