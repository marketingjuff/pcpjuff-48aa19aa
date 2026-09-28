# Renomear "Baby Look Canoa" para "T-Shirt Canoa"

## Única alteração
Arquivo `src/lib/pedidos.ts`, linha 41, dentro de `REFACAO_MODELOS`: trocar `"Baby Look Canoa",` por `"T-Shirt Canoa",`, na mesma posição (entre `"ML Hide Infantil"` e `"Regata Breeze"`).

Busca prévia: `Baby Look Canoa` aparece só nessa linha em todo o `src`.

## O que não muda
- `"Baby Look"` original, posição dos itens, `REFACAO_CORES`, `REFACAO_TAMANHOS`, `cmpModelo`, `_MODELO_ORD`, `_MODELO_IDX`.
- Nenhum outro arquivo, nenhuma migração, nenhum SQL.

## Ao final
Typecheck, diff do arquivo e nova busca por `Baby Look Canoa` (esperado: zero).
