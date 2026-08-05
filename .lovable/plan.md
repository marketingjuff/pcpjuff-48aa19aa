# Permissões granulares por aba (PCP / COP / MAP / SUP / KPI)

100% frontend. Nenhuma migração SQL, nenhum `UPDATE` em massa, nenhum dado de usuário reescrito.
`user_roles.areas_extras` continua sendo a única coluna usada.

## 1. Novo `src/lib/permissoes.ts`

- Tipos `ModuloKey`, `PermissaoKey`, `AbaPermissao` e o catálogo `CATALOGO_PERMISSOES` com as chaves `modulo.aba` exatamente como na especificação (10 PCP, 11 COP, 6 MAP, 4 SUP, 4 KPI), reaproveitando os `tabValue` já usados nas rotas.
- `MODULOS` (ordem: pcp, cop, map, sup, kpi) com label e rota.
- `normalizarPermissoes(areasExtras, role)`:
  - traduz chaves legadas (`arte` → `pcp.arte`, `cop`/`map`/`sup` → todas as chaves daquele módulo, etc.);
  - mantém chaves já no formato novo; ignora desconhecidas em silêncio;
  - se `role === "gestor"` e o array for inteiramente legado, adiciona `pcp.dashboard`, `pcp.finalizados`, `pcp.retrabalho` (retrocompatibilidade).
- Helpers: `abasDoModulo`, `permissoesDoModulo`, `labelDaPermissao`, `rotaInicial(permissoes, isAdmin)`.
- `PRESETS` com os 12 presets da tabela.
- Abas fora do catálogo (Históricos, Monitor de Preços) continuam admin-only.

## 2. `src/hooks/use-role.ts`

- Mantém todas as exportações atuais.
- Novos: `useMinhasPermissoes()`, `usePode(key)`, `useAbasPermitidas(modulo)`, `useModulosPermitidos()`, `useCanAccessKpi()`.
- `useCanAccessCop/Map/Sup` reimplementados: admin **ou** ≥1 permissão do módulo (deixam de exigir papel gestor).

## 3. Rotas

Padrão nas 5 rotas: abas vindas de `useAbasPermitidas(modulo)`; abas admin-only anexadas no fim com as condições atuais; aba inválida (URL/localStorage) cai na primeira permitida; sem nenhuma aba do módulo → redirect (`replace`) para `rotaInicial`, só depois de as permissões carregarem.

- **index.tsx (PCP)**: remove as regras implícitas de `isManager` na visibilidade de abas; `dados` aparece com `pcp.dados_in_vendedor` ou `pcp.dados_in_producao`; `canManage` intocado; `canReabrir` = `isAdmin || (isGestor && pode("pcp.expedicao"))`; tela "Sem permissões atribuídas" (com botão Sair) quando o usuário não tem nada.
- **cop.tsx**: `BASE_TABS` dinâmico; remove o gate/toast "restrito a administradores e gestores"; `historico` admin-only.
- **map.tsx / sup.tsx**: idem; no SUP preserva o alias `alteracoes-preco` → `monitor-precos` e o Monitor admin-only.
- **kpi.tsx**: remove o bloqueio admin-only; aba inicial = primeira permitida.
- **MacroSwitch** (em `cop.tsx`): cada botão — incluindo PCP e KPI — só aparece com ≥1 aba do módulo; com apenas 1 módulo o switch não é renderizado.
- Botão "Configurações" nos headers de cop/map/sup/kpi passa a `{(isAdmin || isGestor) && …}`.

## 4. `configuracoes.tsx` — apenas `UsuariosTab`

- `AreasCheckboxes` → novo `PermissoesPanel({ value, onChange })`: um bloco recolhível por módulo, cabeçalho com contador `(2 de 11)` e checkbox tri-estado de marcar/desmarcar o módulo, abas em grid de 2 colunas (`text-xs`, `Checkbox`). Blocos com marcações abrem expandidos. Mesmo catálogo para gestor e operador; não exibido para admin.
- Linha de presets com `Select` "Aplicar preset…" + `AlertDialog` de confirmação listando os labels; aplicar substitui a seleção, cancelar não altera nada.
- Usado na criação de conta e, na tabela de usuários, dentro de um `Popover` acionado por botão "Permissões (n)", com save imediato por toggle como hoje.
- Leitura passa por `normalizarPermissoes` antes de exibir; papel `admin` continua enviando `areas_extras: []`; troca gestor↔operador preserva as marcações (reset só na criação).

## Notas técnicas

Sem alterações em `src/lib/admin.functions.ts` (server functions seguem com `assertAdmin()`), em `schema-extras.ts` (exports mantidos, mesmo sem uso) ou em qualquer componente de módulo. A aba Usuários permanece dentro de `{isAdmin && …}`. Verificação final com typecheck.
