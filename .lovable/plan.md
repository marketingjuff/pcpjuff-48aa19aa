# Corrigir ReferenceError na ListasTab (TDZ da const catalogo)

## Problema
Em `src/routes/_authenticated/configuracoes.tsx`, linha 1208, a callback do `useMemo` que monta a const `catalogo` lê a própria `catalogo` (ainda na temporal dead zone) em vez do `LISTAS_CATALOGO` importado. Resultado: `ReferenceError: Cannot access 'catalogo' before initialization` toda vez que a aba Listas renderiza.

## Plano (arquivo por arquivo)

### src/routes/_authenticated/configuracoes.tsx (único arquivo tocado)
- Import (linhas ~80-88): adicionar `LISTAS_CATALOGO` ao import já existente de `@/lib/config-listas-catalogo` (hoje ele não está importado nesse arquivo; a exportação existe em `src/lib/config-listas-catalogo.ts:18`).
- Linha 1208: trocar `catalogo.filter((i) => !i.kind.startsWith("refacao_problema_"))` por `LISTAS_CATALOGO.filter((i) => !i.kind.startsWith("refacao_problema_"))`.
- Nada mais muda: a const `catalogo` continua sendo o resultado do `useMemo`, a lista de dependências `[areasErro]` permanece, e os usos de `catalogo` fora da callback (linhas 1237 e 1263) ficam como estão.

## Fora de escopo
- Nenhuma migração, nenhum SQL.
- Nenhum outro arquivo criado, modificado ou removido.

## Verificação
- Rodar `bunx tsgo --noEmit -p tsconfig.json` e mostrar o resultado.
- Gerar o diff em /mnt/documents/ para conferência.
