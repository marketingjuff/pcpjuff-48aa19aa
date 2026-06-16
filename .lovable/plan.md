# Padronização visual + compactação

## Objetivo
Aplicar o mesmo visual do **Dashboard Master** em todas as outras abas (Dados In, Arte, DTF, Silk, Acabamento, Expedição, Finalizados) e reduzir o espaço em branco em toda a aplicação **sem alterar tamanhos de fonte**, sem mexer em colunas, ordem, filtros, dados ou lógica.

## 1. Extrair padrão "Master" para um lugar reutilizável
Em `src/components/pcp/shared.tsx`, criar constantes/utilitários compartilhados para garantir 100% de paridade visual:

- `TABLE_FONT_STYLE` → `{ fontFamily: '"Google Sans Flex", Arial, sans-serif', fontStretch: 'condensed' }`
- `TABLE_WRAPPER_CLASS` → `"hidden md:block rounded-lg border border-border/60 bg-card overflow-x-auto shadow-xs"`
- `TH_CLASS` → `"h-7 px-1.5 text-[11px]"` (cabeçalho mais baixo que hoje, de h-8 → h-7)
- `TD_CLASS` → `"py-0.5 px-1.5 text-[11px] align-top"` (linha mais compacta, de `py-1` → `py-0.5`)
- `BADGE_SM_CLASS` → `"text-[10px] px-1.5 py-0"`

Aplicar nessas constantes no Master e em todas as outras abas, para que qualquer ajuste futuro fique sincronizado.

## 2. Compactar o Dashboard Master (referência)
Em `src/components/pcp/DashboardTab.tsx`:

- Container raiz: `space-y-6` → `space-y-3`.
- Grid de StatCards: `gap-3` → `gap-2`; reduzir padding interno do `StatCard` (CardHeader/CardContent com `p-2`, sem `space-y` desnecessário).
- `Card` de Pedidos: `CardHeader pb-3` → `pb-2`, `CardContent space-y-4` → `space-y-2`, `CardContent` com `p-3`.
- Barra de filtros: grid `gap-3` → `gap-2`, `space-y-1` dos labels → `space-y-0.5`, altura dos `Input`/`SelectTrigger`/`DateInputBR` reduzida via classe `h-8` (sem mexer no `text-sm`).
- Tabela: trocar inline classes pelas constantes compartilhadas (cabeçalho `h-7`, células `py-0.5`).

## 3. Aplicar mesmo padrão nas demais abas
Arquivos: `DadosInTab.tsx`, `ArteTab.tsx`, `DTFTab.tsx`, `SilkTab.tsx`, `AcabamentoTab.tsx`, `ExpedicaoTab.tsx`, `FinalizadosTab.tsx`.

Em cada um:
- Importar as constantes do `shared.tsx`.
- Wrapper da tabela desktop → `TABLE_WRAPPER_CLASS` + `style={TABLE_FONT_STYLE}` (Google Sans Flex condensed igual ao Master).
- `TableHead` → `TH_CLASS`; `TableCell` → `TD_CLASS`; `Badge` pequenos → `BADGE_SM_CLASS`.
- Reduzir `space-y` raiz para `space-y-3`, `Card` com `CardContent` em `p-3 space-y-2`, `CardHeader` em `pb-2`.
- Barra de filtros (Dados In já tem) → mesmo grid `gap-2`, mesma altura `h-8` dos campos, labels `space-y-0.5`.
- Cards de resumo no topo (onde houver): `gap-2`, `p-2`.

## 4. Restrições respeitadas
- **Nenhuma** mudança em tamanhos de fonte (mantém `text-[11px]`, `text-[10px]`, `text-sm`, etc.).
- **Nenhuma** coluna, filtro ou funcionalidade adicionada/removida.
- **Nenhuma** mudança na ordem das colunas.
- **Nenhuma** mudança em lógica de dados ou fluxos.

## Resumo de arquivos editados
- `src/components/pcp/shared.tsx` — adicionar constantes de estilo.
- `src/components/pcp/DashboardTab.tsx` — compactar topo, filtros e tabela; usar constantes.
- `src/components/pcp/DadosInTab.tsx` — adotar constantes; compactar topo/filtros/linhas.
- `src/components/pcp/ArteTab.tsx`, `DTFTab.tsx`, `SilkTab.tsx`, `AcabamentoTab.tsx`, `ExpedicaoTab.tsx`, `FinalizadosTab.tsx` — adotar constantes; mesmo padrão compacto.

Aguardo aprovação para implementar.
