## Objetivo

Resolver os avisos do Dependency Audit (1 high + 1 medium) atualizando o `@tanstack/react-start` (que arrasta `@tanstack/start-server-core` corrigido) e forçando o `undici` transitivo para uma versão sem as CVEs listadas. Nenhuma mudança de lógica.

## Passos

1. **Atualizar pacotes TanStack**
   - `bun add @tanstack/react-start@latest @tanstack/react-router@latest`
   - Manter ambos alinhados (são versionados juntos) para evitar mismatch de tipos do router.

2. **Forçar versão corrigida do undici via overrides**
   - Editar `package.json` adicionando:
     ```json
     "overrides": {
       "undici": "^7.28.0"
     }
     ```
   - Isso cobre o `undici` puxado transitivamente (via `cheerio` dentro do `start-plugin-core`) que hoje está em 7.24.8 com as falhas de TLS bypass, WebSocket DoS, SOCKS5 pool reuse, header injection e cache disclosure.

3. **Regenerar lockfile**
   - Rodar `bun install` para reescrever `bun.lock` com as versões novas e o override aplicado.

4. **Validação**
   - Conferir o build automático do harness (sem erro de tipo / SSR).
   - Subir a preview e confirmar que carrega sem runtime error.
   - Rodar novamente o Dependency Audit (`code--dependency_scan`) e reportar o resultado — marcar como `mark_as_fixed` os findings `vulnerable_dependencies_high` e `vulnerable_dependencies_medium` se sumirem, ou reportar o que sobrar.

## Fora de escopo

- Nenhuma alteração em `src/lib/pedidos.ts`, `refacao-helpers.ts`, abas de PCP, RLS, ou qualquer regra de negócio.
- Sem refactor de imports — as APIs públicas do `@tanstack/react-start` e `react-router` usadas no projeto (createServerFn, createFileRoute, Link, useNavigate, etc.) são estáveis dentro do major 1.x.

## Riscos e mitigação

- **Breaking change menor no TanStack**: se o `latest` introduzir mudança incompatível, fixar na maior versão >= 1.167.50 que contenha o fix de `start-server-core` (GHSA-9m65-766c-r333) e reportar.
- **Override do undici não aplicado pelo bun**: bun suporta `overrides` no formato npm; se o lockfile não refletir, alternar para `resolutions` (yarn-style) que o bun também aceita.
