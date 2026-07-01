## Objetivo
Substituir o layout em cards da aba **Oficinas Hoje** por uma única **tabela pivot hierárquica** (Oficina → COP → Modelo → Cor) com expandir/recolher por linha, colunas fixas (esquerda e direita) e cabeçalho sticky. Somente frontend, sem migrações.

## Arquivos

### 1. `src/lib/cop-oficinas.ts` (aditivo)
Adicionar (sem alterar o existente):

- Tipos:
  ```ts
  type NoCor    = { cor: string; porTamanho: Record<string, number>; total: number };
  type NoModelo = { modelo: string; cores: NoCor[]; total: number };
  type NoCop    = { cop: Cop; rotulo: string; modelos: NoModelo[]; total: number };
  type NoOficina= { oficina: Oficina; cops: NoCop[]; total: number };
  ```
- `arvoreOficinasHoje(cops, oficinas)` — usa `copsPorOficina` e `rotuloRomaneio`, agrega `pecas` por modelo → cor → tamanho somando `qtd`. Ordenação:
  - Oficinas: total desc (igual hoje)
  - COPs: por `rotuloRomaneio`
  - Modelos: índice em `REFACAO_MODELOS` (fallback alfabético)
  - Cores: índice em `REFACAO_CORES` (fallback alfabético)

### 2. `src/components/cop/OficinasHojeTab.tsx` (reescrita da renderização)
Manter queries `["cops"]`/`["oficinas"]`, canal realtime `cops-oficinas-hoje`, `h2`, contadores de resumo e botão recarregar.

**Substituir** o grid de cards por uma única tabela.

**Colunas (nesta ordem):**
`Oficina | COP | Modelo | Cor | PP | P | M | G | GG | EXG | EXXG | Total Geral`

- Tamanhos mapeados de `REFACAO_TAMANHOS` (sem hardcode).
- Cabeçalho `sticky top-0 bg-muted/40 z-20`.
- Colunas Oficina/COP/Modelo/Cor: `sticky left-*` com background sólido, `z-10`.
- Total Geral: `sticky right-0`, background sólido.
- Colunas de tamanho: `w-12 text-right tabular-nums`; zero renderizado como `–`.
- Container: `overflow-auto rounded-md border` com `max-h` para permitir sticky vertical.

**Renderização das linhas (modo tabular/outline):**
Cada linha ocupa **apenas a célula do seu próprio nível** com `ícone chevron + rótulo`; as outras 3 colunas de rótulo ficam vazias.

| Nível   | Célula preenchida | Tamanhos | Total Geral        |
|---------|-------------------|----------|--------------------|
| Oficina | Oficina           | vazias   | subtotal oficina   |
| COP     | COP (`rotuloRomaneio`) | vazias | subtotal COP    |
| Modelo  | Modelo            | vazias   | subtotal modelo    |
| Cor     | Cor               | valores  | soma dos 7         |

Linhas-pai (Oficina/COP/Modelo) com `bg-muted/20`. Cor é folha (sem chevron).

**Estado de expansão:**
- `useState<Set<string>>` com chaves estáveis: `of:{oficinaId}`, `cop:{oficinaId}/{copId}`, `mod:{oficinaId}/{copId}/{modelo}`.
- Ao montar: sementes com todas as chaves `of:*` (oficinas abertas, demais recolhidos).
- Botões globais no topo: **Expandir tudo** / **Recolher tudo**.
- Toggle por linha via chevron (`ChevronRight` recolhido / `ChevronDown` expandido).
- Sem navegação automática entre abas.

**Fluxo de render:** iterar árvore e, para cada nível, empurrar a linha do pai; se expandido, iterar filhos recursivamente. Uma única `<tbody>`.

## Fora de escopo
- Não alterar `copAtivoEmOficina`, queries, realtime, `cop-saldos`, Disponível, Falta, Pagamentos.
- Não adicionar coluna Status.
- Sem migração de banco. Sem paleta nova.

## Aceite
1. Ao abrir: oficinas expandidas, COP/Modelo/Cor recolhidos.
2. Expandir COP mostra Modelos; expandir Modelo mostra Cores com os 7 tamanhos + Total Geral.
3. Expandir/Recolher tudo funcionam.
4. Cabeçalho, colunas de rótulo e Total Geral permanecem visíveis nas rolagens.
5. Soma horizontal da Cor e subtotais dos pais batem com o total atual da oficina.
