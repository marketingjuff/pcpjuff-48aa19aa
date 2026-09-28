# Incluir modelo "Baby Look Canoa" no catálogo

## Única alteração
Arquivo `src/lib/pedidos.ts`, constante `REFACAO_MODELOS` (linhas 36–42): inserir a linha `"Baby Look Canoa",` entre `"ML Hide Infantil"` e `"Regata Breeze"`.

```ts
export const REFACAO_MODELOS = [
  "Camiseta", "Baby Look", "Regata Masculina", "Regata Feminina",
  "ML Masculina", "ML Feminina", "Camiseta Infantil", "ML Infantil",
  "Regata Cross", "Regata Wing", "Regata Move",
  "ML Hide Masculina", "ML Hide Feminina", "ML Hide Infantil",
  "Baby Look Canoa",
  "Regata Breeze", "Não Identificado",
] as const;
```

## O que não muda
- Nenhum outro arquivo, nenhuma migração, nenhum SQL.
- `REFACAO_CORES`, `REFACAO_TAMANHOS`, `cmpModelo`, `_MODELO_ORD`, `_MODELO_IDX` intactos (ordem se ajusta sozinha pela posição).
- Sem preço padrão de oficina; sem mexer em mapeamento Olist.

## Ao final
Typecheck (`bunx tsgo --noEmit -p tsconfig.json`) e diff do arquivo.
