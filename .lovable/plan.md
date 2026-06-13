## Objetivo

Tornar o PCP Juff utilizável em celular (≤640px) sem alterar a experiência desktop de como está nesse momento. Todas as abas, dashboards, formulários e Configurações funcionarão mobile-first com base nos padrões `sm:`/`md:` do Tailwind v4.

## 1. Shell e navegação (`src/routes/_authenticated/index.tsx`)

- **Header**: aplicar grid `grid-cols-[minmax(0,1fr)_auto]` + `min-w-0` para evitar quebra. Logo encolhe (h-9 → h-8), subtítulo "Controle de produção" oculto em `<sm`. Botões "Configurações" e "Sair" viram apenas ícone em `<sm`.
- **Menu hambúrguer**: trocar `TabsList` por uma `Sheet` (shadcn) que abre por um botão `Menu` no header em `<md`. Cada item do menu fecha o sheet ao selecionar a aba. Em `≥md` continua aparecendo a `TabsList` horizontal como hoje.
- Mostrar o nome da aba ativa ao lado do botão hambúrguer (ex.: "Dashboard Master"), para o usuário saber onde está.

## 2. Tabelas viram cards no mobile (padrão único)

Criar componente novo `src/components/pcp/PedidoCardList.tsx` que, dado uma lista de pedidos + config (`columns: {label, render}[]` + `onClick`), renderiza:

- `≥md`: a tabela atual (mantida intacta);
- `<md`: lista de cards empilhados com: linha 1 = Pedido + Etapa badge, linha 2 = Orçamento (truncado), linha 3 = chips/labels dos campos secundários (QTD, Tipo, Status, Frete, Data Entrega).

Aplicar em:

- `DashboardTab.tsx` (tabela principal Pedidos)
- `DadosInTab.tsx` (lista de pedidos ativos)
- `ArteTab.tsx`, `DTFTab.tsx`, `SilkTab.tsx`, `AcabamentoTab.tsx` (dashboards por área)
- `ExpedicaoTab.tsx` (dashboard de expedição — chip "Pendências" no topo do card)
- `FinalizadosTab.tsx`

Filtros acima das tabelas/cards: trocar grid atual `md:grid-cols-3 lg:grid-cols-6` por `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6`, garantindo que cada `Input`/`Select` ocupe largura inteira no mobile.

Os "stat cards" do Dashboard Master passam de `md:grid-cols-3 lg:grid-cols-6` para `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` (2 colunas no mobile, valor menor `text-2xl` em `<sm`).

## 3. Formulários de detalhe em seções colapsáveis

Criar `src/components/pcp/CollapsibleSection.tsx` (wrapper sobre o `Accordion` da shadcn), com `defaultOpen` configurável e visual condensado.

Reorganizar os formulários para usar 1 coluna no mobile e agrupar campos hoje soltos:

- **DadosInTab**: seções "Identificação", "Pagamento e NF", "Frete", "Produção", "Layout/Observações". Grids passam de `md:grid-cols-3` para `grid-cols-1 sm:grid-cols-2 md:grid-cols-3`.
- **ArteTab**: seções "Dados do pedido (somente leitura)", "Vetorização" (se aplicável), "DTF" (se aplicável), "Silk" (se aplicável), "Status e Observações".
- **DTFTab / SilkTab**: seções "Dados do pedido", "Execução", "Observações".
- **AcabamentoTab**: seções "Dados do pedido", "Conferência", "Embalagem e finalização".
- **ExpedicaoTab**: seções "Dados do pedido", "Checklist" (itens condicionais à forma de pagamento), "Observações". Botões "Salvar" e "Marcar tudo como Sim" passam a `w-full sm:w-auto` em mobile.

Banners (`EtapaTopoBanner`, `EtapaStatusBanner`) sempre visíveis no topo, fora das seções colapsáveis.

## 4. Configurações (`src/routes/_authenticated/configuracoes.tsx`)

- Sub-abas internas convertidas no mesmo padrão (Tabs horizontais em `≥md`, `Select` no mobile).
- Tabelas de Usuários, Listas, Feriados, Backups viram cards no mobile (mesmo `PedidoCardList` adaptado ou variantes específicas).
- Modais/diálogos abrem `w-full` no mobile, com padding reduzido.
- Botões de ação que hoje ficam à direita das linhas viram um menu `⋮` (DropdownMenu) por linha/card no mobile.

## 5. Ajustes globais de UI

- `src/styles.css`: garantir que body tenha `overflow-x-hidden` para evitar scroll horizontal acidental causado por algum filho.
- `Card` headers que usam `flex-row items-center justify-between` recebem `flex-wrap gap-2` (já presentes em alguns lugares — padronizar).
- Inputs de data (`DateInputBR`) recebem `w-full` por padrão.
- Definir media query para preview: testar em `375x812`, `390x844` e `768x1024`.

## Validação

- Abrir cada aba em 375px e conferir: sem scroll horizontal, todos os botões alcançáveis, cards legíveis, formulários salvam, hamburguer funciona.
- Conferir em 768px (tablet) — formulários em 2 colunas, tabelas ainda como cards (pois `<md`), ou já como tabela conforme breakpoint definido.
- Conferir em 1280px — desktop intocado.

## Não está no escopo

- Reescrever componentes shadcn base.
- Mudar lógica de negócio, queries, schema, ou layout desktop existente além do necessário para o mobile.
- PWA / instalação como app / offline.