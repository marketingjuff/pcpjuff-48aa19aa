## Sugestões de feriados (nacionais + SP estado + SP capital)

Adicionar uma seção de **Sugestões** dentro da aba "Feriados" em Configurações, mantendo a adição manual exatamente como está hoje.

### Fontes

- **Nacionais**: BrasilAPI — `https://brasilapi.com.br/api/feriados/v1/{ano}` (gratuita, sem chave). Busca para o **ano atual + 5 próximos** (ex.: 2026, 2027, 2028,2029,2030,2031).
- **Estado de SP**: lista fixa no código (data móvel calculada quando necessário):
  - 09/jul — Revolução Constitucionalista de 1932
- **Capital SP**: lista fixa no código:
  - 25/jan — Aniversário de São Paulo
  - Sexta-feira Santa (móvel — calculada a partir da Páscoa)
  - Corpus Christi (móvel — calculada a partir da Páscoa)
  - 20/nov — Consciência Negra (já é nacional desde 2024, será deduplicado)

Datas móveis são calculadas com algoritmo de Gauss para a Páscoa — sem API extra.

### UI dentro da aba Feriados

1. Formulário manual atual **permanece igual** no topo.
2. Tabela de feriados cadastrados **permanece igual** abaixo.
3. Nova seção "Sugestões" entre o formulário e a tabela, com 3 grupos colapsáveis:
  - Nacionais (BrasilAPI)
  - Estado de São Paulo
  - Capital de São Paulo
4. Cada item da sugestão mostra **data + descrição** e:
  - Botão "Adicionar" individual (some/fica desabilitado quando a data já existe na tabela).
  - Botão "Adicionar todos os pendentes" no topo de cada grupo (insere em lote os que ainda não estão cadastrados).
5. Itens já cadastrados aparecem riscados/com badge "já adicionado".
6. Filtro por ano (chips: 2026 / 2027 / 2028) no topo da seção de sugestões.

### Comportamento técnico

- Fetch direto do navegador para BrasilAPI via `useQuery` (sem server function — endpoint público, CORS liberado).
- Estado de erro: se a BrasilAPI falhar, mostrar aviso discreto "Não foi possível carregar feriados nacionais" e manter as listas SP (que são offline).
- Inserção reaproveita o mesmo `INSERT` em `feriados` já usado pelo formulário manual.
- Deduplicação por `data` (única chave já existente na tabela hoje, comparada após carregar `feriados`).

### Arquivos afetados

- `src/routes/_authenticated/configuracoes.tsx` — adicionar `SugestoesFeriados` dentro de `FeriadosTab`.
- `src/lib/feriados-sugestoes.ts` (novo) — listas estáticas SP + cálculo de Páscoa/Sexta Santa/Corpus Christi + fetch BrasilAPI.

Nenhuma alteração de schema, nenhuma migration.