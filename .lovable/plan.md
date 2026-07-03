## Reordenar e alinhar tamanhos nas listas de Corte e Romaneio

Objetivo: nas tabelas da aba **Corte** e da aba **Romaneio**, mudar a ordem das colunas e trocar o "Resumo das peças" por colunas de tamanhos alinhadas globalmente (padrão da aba *Falta por Pedido*).

### Nova estrutura das colunas

**Corte** (`src/components/cop/CorteTab.tsx`):
`Número · Oficina · Status · Modelo · Cor · [colunas de tamanhos: PP, P, M, G, GG, XG, ...] · Tot.`

**Romaneio** (`src/components/cop/RomaneioTab.tsx`):
`Romaneio · Oficina · Status · Modelo · Cor · [colunas de tamanhos alinhadas] · Tot. · Recebimento`

### Como as linhas se comportam

- Igual à `FaltaPorPedidoTab`: cada combinação **modelo+cor** vira uma linha.
- As colunas `Número/Oficina/Status` (e `Recebimento` no Romaneio) usam `rowSpan` na primeira linha de cada COP.
- As colunas de tamanhos são o **conjunto union** de todos os tamanhos presentes na lista filtrada, ordenadas via `colunasTamanhos(...)` (já exportada em `@/lib/cop`), garantindo alinhamento vertical entre COPs.
- Cada célula de tamanho mostra a quantidade daquele modelo+cor+tamanho (ou "–" se não houver). Coluna final "Tot." soma o modelo+cor.
- Cor renderizada com o badge colorido já usado (`corHex` / `corTextoSobre`), igual à `FaltaPorPedidoTab`.
- Clique em qualquer linha do bloco continua selecionando o COP e rolando para o editor (`selectAndScroll`).

### Ordenação e filtros

- Mantém `SortableTh` em Número, Oficina, Status (e Recebimento no Romaneio) — cabeçalhos ficam nessa nova ordem.
- Filtros/busca/toolbar acima da tabela ficam inalterados.

### Fora do escopo

- `ResumoPecas` local dos dois arquivos deixa de ser usado na lista principal; mantém-se apenas se ainda usado em outro lugar (checar imports antes de remover).
- Não altera o editor selecionado nem regras de negócio; é apenas apresentação.
