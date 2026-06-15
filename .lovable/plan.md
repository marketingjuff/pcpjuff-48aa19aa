# Refinamento Visual Premium — App Inteiro

Objetivo: elevar a percepção de qualidade do PCP Juff mantendo **todo o conteúdo, layout e densidade compacta atuais**. Sem mexer em lógica de negócio, queries ou fluxos.

## Direção visual

- Paleta clara sofisticada: off-white com leve tom quente em vez de branco puro, azul Juff mantido como acento, hierarquia construída com tons neutros e não com peso de cor.
- Tipografia editorial: importar **Inter Tight** (display, headings) + **Inter** (body) via `<link>` no `__root.tsx`. Ajustar `letter-spacing` negativo em títulos e `font-feature-settings` para numerais tabulares em KPIs/tabelas (essencial para colunas de números alinhadas).
- Sombras suaves em duas camadas (`shadow-xs` ambient + halo sutil), em vez de bordas duras. Bordas passam a `border-color: color-mix(... 60% transparent)` para parecerem "ar" e não traço.
- Raio: subir `--radius` para `0.75rem` (cards/inputs ficam mais modernos sem inflar densidade).
- Foco/ring: ring 2px com `color-mix` do primary a 35% — premium e acessível.

## Tokens (src/styles.css)

- Ajustar `:root`:
  - `--background: oklch(0.985 0.003 80)` (off-white levemente quente)
  - `--card: oklch(1 0 0)` mantém, mas adicionar `--card-elevated` e sombras semânticas
  - `--border: oklch(0.92 0.008 250)` mais clara
  - `--muted-foreground: oklch(0.45 0.02 257)` (mais legível)
  - `--primary` mantém; adicionar `--primary-soft: oklch(0.95 0.04 258)` para chips/hover
  - `--radius: 0.75rem`
- Adicionar tokens:
  - `--shadow-xs`, `--shadow-sm`, `--shadow-md` (sombras de duas camadas)
  - `--gradient-surface` para superfícies sutis (KPIs, header)
- Mapear no `@theme inline` (`--color-primary-soft`, `--shadow-*`) para uso em utilitários.
- `@layer base`:
  - `body { font-family: "Inter", ui-sans-serif; }`
  - Numeral tabular global em `.tabular`, `th`, `td` de tabelas, badges com números.
  - Headings: `font-family: "Inter Tight"; letter-spacing: -0.02em;`
- Dark mode: ajustes equivalentes (não é o foco, mas mantém consistência).

## Carregamento de fonte (src/routes/__root.tsx)

Adicionar `<link rel="preconnect">` e `<link rel="stylesheet">` para Inter + Inter Tight no `head` (via `links` array do route head).

## Componentes a refinar (sem mudar conteúdo)

1. **Header (`_authenticated/index.tsx`)**
   - Trocar caixa azul do logo por superfície branca com borda sutil + ícone em primário; título com `Inter Tight`, tracking-tight.
   - Linha divisória virar gradiente sutil (`border-b` com `color-mix`).
   - Botões Configurações/Sair: variantes `ghost` com hover suave `bg-primary-soft`.

2. **Tabs (TabsList)**
   - Pill bar minimalista: fundo `muted/40`, item ativo com `bg-card` + `shadow-xs` (efeito "card flutuante"), inativos `text-muted-foreground` com hover.
   - Padding interno consistente, altura uniforme.

3. **KPI cards (DashboardTab topo)**
   - Card com `shadow-xs`, hover `shadow-sm` + translate-y-[-1px] (transição 200ms).
   - Label uppercase tracking-wider em `muted-foreground` text-[11px].
   - Número grande em `Inter Tight` `text-4xl font-semibold tabular-nums tracking-tight`.
   - Ícone em badge circular suave (`bg-primary-soft text-primary`), tamanho consistente.
   - Card "ativo" usa borda primária + halo (`ring-2 ring-primary/15`) em vez de borda 2px dura.

4. **Card "Pedidos" (filtros + tabela)**
   - Header com título maior + subtítulo opcional vazio (placeholder de hierarquia).
   - Filtros: grid responsivo com gap consistente (12px), inputs com altura 36px alinhada, ícones lucide leading (search, calendar) dentro dos inputs.
   - Tabela:
     - `th` em uppercase tracking-wider text-[11px] muted, `border-b` mais sutil.
     - Linhas com hover `bg-muted/40`, divisor `border-b/60`.
     - Numerais tabulares em QTD, Dias, %, datas.
     - Badges (Etapa, Tipo, Status Peças): raio menor, padding consistente, paleta semântica (success/warning/info/destructive soft).
     - Ações (Pencil/Eye) em botões `ghost` size-icon com hover `bg-muted`.
     - Progress bar mais fina (h-1.5) com cor primária.

5. **Badges/Chips (shared.tsx)**
   - Padronizar `StatusPecasBadge`, `StatusPecasChip`, chips de etapa para usar tokens semânticos (`bg-success/12 text-success-foreground` style soft).
   - Asterisco de reaberto em cor `warning` discreta.

6. **Forms (Dados In, Arte, DTF, Silk, Acabamento, Expedição)**
   - Labels: text-xs uppercase tracking-wide muted.
   - Inputs/Selects: altura 36px, raio do token, border suave, foco com ring premium.
   - Seções dentro do form: dividers sutis, espaçamento vertical consistente (`space-y-5`).
   - Botões primários com leve gradiente (`from-primary to-primary` com overlay) + sombra.

7. **Auth (`routes/auth.tsx`)**
   - Card centralizado com sombra `md`, header com logo + título editorial, inputs e botão alinhados ao novo sistema.

8. **Configurações**
   - Cards e seções com novos tokens; tabelas no mesmo padrão da Dashboard.

9. **Banners (PendenciasBanner, PropostaDataAlerta)**
   - Substituir cor chapada por superfície soft (`bg-warning/8 border-warning/20`), ícone em círculo, tipografia hierárquica.

10. **404 / Error boundary (`__root.tsx`)**
    - Atualizar tipografia e botões ao novo sistema (já usa tokens; pequena melhoria de tracking/spacing).

## Garantias de escopo

- **Conteúdo inalterado**: nenhum texto, coluna, campo, badge ou fluxo removido/renomeado.
- **Densidade compacta preservada**: alturas de linha, paddings de tabela e tamanhos de fonte do corpo permanecem ≤ atuais; o "premium" vem de tipografia, sombras, tokens e hierarquia, não de inflar espaçamento.
- **Sem alterações de lógica, dados, RLS, server functions ou migrations.**

## Arquivos previstos

- `src/styles.css` (tokens, fontes, base)
- `src/routes/__root.tsx` (link fonts, polish 404/error)
- `src/routes/_authenticated/index.tsx` (header + TabsList)
- `src/components/pcp/DashboardTab.tsx` (KPIs, filtros, tabela)
- `src/components/pcp/shared.tsx` (badges/chips, etapaPaletteClass)
- `src/components/pcp/DadosInTab.tsx`, `ArteTab.tsx`, `DTFTab.tsx`, `SilkTab.tsx`, `AcabamentoTab.tsx`, `ExpedicaoTab.tsx`, `FinalizadosTab.tsx`, `PendenciasBanner.tsx` (padrão visual de forms/tabelas/banners)
- `src/routes/auth.tsx`, `src/routes/_authenticated/configuracoes.tsx` (mesma linguagem)
- Possível ajuste em `src/components/ui/button.tsx`, `card.tsx`, `input.tsx`, `badge.tsx`, `tabs.tsx`, `table.tsx` para variantes/sombras (apenas se necessário; preferir className por consumo).

## Validação

- Screenshot da Dashboard, de uma aba de produção, de Auth e Configurações após aplicar.
- Verificar build TS limpa.
