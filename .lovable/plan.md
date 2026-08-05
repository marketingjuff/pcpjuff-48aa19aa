# Nível "Somente leitura" nas permissões + estado das abas preservado (SUP/KPI)

100% frontend. Zero SQL, zero `UPDATE` em massa. `user_roles.areas_extras` continua o único armazenamento — o nível vai como sufixo na chave (`pcp.acabamento:leitura`); chave sem sufixo continua significando edição.

## Parte A — Edição vs Somente leitura

### A.1 `src/lib/permissoes.ts`
- `NivelAcesso = "edicao" | "leitura"`, campo `nivelConfiguravel` em `AbaPermissao` — `true` apenas nas 9 abas do PCP (dados_in_vendedor, dados_in_producao, arte, dtf, silk, acabamento, expedicao, finalizados, retrabalho), `false` em todo o resto (inclui `pcp.dashboard` e todas as abas de COP/MAP/SUP/KPI).
- Novos: `parsePermissao`, `serializarPermissao`, `niveisPermissoes(areasExtras, role)`.
- `normalizarPermissoes` mantém assinatura e comportamento; passa a ignorar o sufixo ao identificar a chave (leitura continua vendo a aba).
- Dois presets novos: `vendedor_acompanha` e `consulta_pcp`. Os demais seguem em edição.

### A.2 `src/hooks/use-role.ts`
Adiciona `useNiveisPermissoes()`, `usePodeEditar(key)`, `useSoLeitura(key)` mantendo todas as exportações atuais. Admin sempre edita.

### A.3 `src/components/pcp/edicao-policy.ts`
`isReadOnly(aba, pedido, canManage, soLeitura = false)` — `soLeitura` retorna `true` antes de qualquer outra regra, com precedência sobre `canManage`.

### A.4 Componentes PCP
- **ArteTab / DTFTab / SilkTab / AcabamentoTab**: prop `soLeitura?: boolean`, repassada a `isReadOnly`; botões `{canManage && ...}` viram `{canManage && !soLeitura && ...}`; saves já retornam cedo com `readOnly`.
- **DadosInTab**: props independentes `soLeituraVendedor` / `soLeituraProducao` — bloqueio por card (fieldset desabilitado + faixa "Somente leitura — você não tem permissão para editar esta aba"), esconde o `UpdateButton` do card e "Deletar".
- **ExpedicaoTab**: campos desabilitados; esconde "Marcar tudo Sim", salvar, finalizar e ações em lote.
- **FinalizadosTab**: esconde "Reabrir" e ações destrutivas; tabela visível.
- **RetrabalhoTab**: campos desabilitados, salvar escondido.
- Em todos: `if (soLeitura) return;` no início das funções de save.

### A.5 `src/routes/_authenticated/index.tsx`
Passa `soLeitura={soLeitura("pcp.<aba>")}` a cada aba (duas props no DadosInTab). `canReabrir = isAdmin || (isGestor && pode("pcp.expedicao") && podeEditar("pcp.finalizados"))`.

### A.6 `PermissoesPanel` em `configuracoes.tsx`
Ao lado do label das abas com `nivelConfiguravel: true` **e marcadas**, par de botões `Editar | Somente leitura` (leitura com destaque + ícone de olho). Padrão ao marcar: Editar. Cabeçalho do módulo mostra `(3 de 10 · 2 em leitura)` quando houver leitura. `onChange` devolve o array já serializado; leitura inicial via `niveisPermissoes()`.

COP/MAP/SUP ficam sem toggle nesta entrega (não há infraestrutura de leitura nesses componentes).

## Parte B — Estado das abas

- **kpi.tsx**: troca `{tab === "x" && ...}` por `forceMount` + `hidden`, com montagem preguiçosa persistente (Set de abas já visitadas, inicializado com a aba inicial). Só a aba inicial dispara consultas.
- **index / cop / map / sup / kpi**: conjunto de abas montadas congelado — acumula, nunca remove, enquanto o usuário está na tela; `useMyRoles` com `placeholderData: keepPreviousData` para não oscilar em refetch. Segurança inalterada (RLS segue sendo a barreira).
- **Persistência em localStorage** (leitura no inicializador lazy com try/catch, gravação em `useEffect`, JSON inválido ignorado em silêncio):
  - `DashboardSupTab` → `empresa`, `de`, `ate` (`sup:dashboard:filtros`)
  - `MonitorPrecosTab` → `de`, `ate`, `sub` (`sup:monitor:filtros`)
  - `ComissoesTab` → `comp` (`sup:comissoes:comp`)
  - `IndicadoresTab` → `preset`, `intervalo`, `comparar`, `empresa` (`kpi:<escopo>:filtros`)
  - Filtros de seleção múltipla não são persistidos.

## Notas técnicas

Nenhum arquivo fora do escopo da especificação é tocado: nada em `supabase/migrations/**`, `admin.functions.ts`, `cop-saldos.ts`, `pedidos.ts`, `cop.ts`, `map.ts`, `schema-extras.ts`, componentes de COP/MAP ou `auth.tsx`. Verificação final com typecheck.
