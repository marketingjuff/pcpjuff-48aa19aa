# Conector MCP somente leitura do PCP Juff

## Pontos que precisam da sua decisão antes de aprovar

1. **Tela de autorização (consentimento) fora da allowlist.** Para o Claude conectar, a pessoa precisa ver uma tela "Conectar Claude ao PCP Juff" em `/.lovable/oauth/consent` (arquivo `src/routes/[.]lovable.oauth.consent.tsx`). Ela não é gerada pelo plugin. Sem ela, o conector não funciona.
2. **Login precisa voltar para essa tela.** Hoje `src/routes/auth.tsx` sempre manda para `/` depois do login. Quem não estiver logado ao conectar perderia a autorização. Preciso alterar esse arquivo para ler `?next=` (validado como caminho interno) e voltar para ele. Mais um arquivo novo: `src/lib/oauth-return-path.ts` (validador puro).
3. **Ativar o servidor OAuth** (sim, é necessário): pela configuração de Auth do Lovable Cloud (`configure_oauth_server`, sem parâmetros: consentimento em `/.lovable/oauth/consent` e registro automático de clientes ligado). Nada de SQL. Depois confiro se as chaves de assinatura são assimétricas; se ainda forem simétricas (HS256), a migração de chaves é uma ação da plataforma, também sem SQL — paro e peço autorização antes, pois derruba as sessões abertas.

Se aprovar, incluo esses três arquivos (consent, `auth.tsx`, `oauth-return-path.ts`) na allowlist. Se não, entrego o resto, mas o conector não conectará.

## Versões
- `@lovable.dev/mcp-js` **3.4.0** exato (exige zod ^3.25 || ^4; o instalado resolvido é **3.25.76**, então `zod` em `package.json` continua `^3.24.2`, sem troca).
- `xlsx` intocado (^0.18.5 / 0.18.5).

## `vite.config.ts` final
```ts
// (comentários existentes mantidos)
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [mcpPlugin()],
  },
});
```
`trustForwardedHost/Proto` ficam no padrão (ligados).

## Arquivos
- `package.json` + `bun.lock`: só a dependência nova.
- `src/lib/mcp/index.ts`: `defineMcp` (name `pcp-juff`, title `PCP Juff`, 1.0.0, `INSTRUCOES`), `auth.oauth.issuer` com issuer e jwks literais de `onefhxpavfhxdjqsybaf`, audiência `authenticated`, sem `requiredScopes`, `requireOAuthClientClaim` padrão.
- `src/lib/mcp/supabase.ts`: `criarClienteDoUsuario`, `AVISO`, `responder`, `linkSistema` (env lido dentro da função).
- `src/lib/mcp/permissoes.ts`: `carregarPermissoes`, `exigir`, `pedidoVisivel`, `tabDoPedido` (tabela etapa → aba do documento, usando `calcularEtapaAtual`).
- `src/lib/mcp/tools/*.ts`: 10 ferramentas, uma por arquivo.
- Gerados: `src/routes/mcp.ts`, `src/routes/[.well-known]/oauth-protected-resource.ts`, `src/routeTree.gen.ts`, `.lovable/mcp/manifest.json`.

Reaproveito sem alterar: `permissoes.ts`, `pedidos.ts`, `cop.ts`, `indicadores-olist.ts`, `indicadores-store.ts` (nenhum carrega o cliente do navegador). `olist-vendas.ts` importa `xlsx`/`jszip`, então copio só `apenasVigentes`, idêntica, com comentário de origem. `map.ts` não é importado.

## As 10 ferramentas e permissões
| Ferramenta | Permissão |
|---|---|
| mapa_do_sistema | qualquer pessoa logada |
| pedidos_listar | qualquer `pcp.*` exceto ações; filtrado por `pedidoVisivel` |
| pedido_detalhe | igual a pedidos_listar + `pedidoVisivel` do pedido |
| producao_panorama | `pcp.dashboard`, `pcp.monitor` ou `kpi.pcp` |
| cops_listar | qualquer aba `cop.*` (pagamento só com `cop.pagamento`) |
| cop_detalhe | igual a cops_listar (pagamento com `cop.pagamento`; perdas com `cop.perdas`/`cop.controle_perdas`) |
| map_consultar | por visão: prods `map.programacao`/`map.finalizados`; estoque `map.estoque`; devolucoes `map.devolucoes`; quebra `map.quebra` |
| compras_consultar | por visão: pedidos_compra `sup.pedidos`; fornecedores/produtos `sup.produtos`; historico_precos `sup.produtos`/`sup.dashboard`; comissoes `sup.comissoes` |
| vendas_olist_resumo | `kpi.custom` e/ou `kpi.store`; R$ só com `kpi.faturamento` |
| dados_consultar | por área, conforme a tabela do documento |

Todas as 19 tabelas de `dados_consultar` (e as das demais ferramentas) existem em `types.ts`; nenhuma área será retirada. Colunas permitidas escritas à mão, conferidas contra `types.ts`.

## Proteção dos dados
Nenhuma migração, nenhum SQL, nenhuma policy. Só `select`. Verificação por typecheck, build, extração do manifesto e busca por palavras proibidas em `src/lib/mcp`; nenhum teste grava dados.

## Ao final
Typecheck e build, diff de `package.json` e `vite.config.ts`, lista de arquivos, URL do conector (`https://pcpjuff.lovable.app/mcp`, após republicar) e como conectar no Claude.
