# COP — ordem das linhas segue o Romaneio

Conferido no código: os três pontos citados são exatamente os únicos que reordenam as linhas de um COP específico.

## Arquivo por arquivo

### `src/lib/romaneio-pdf.ts`
- Linha 37: `Array.from(map.values()).sort(cmpModeloCor)` passa a ser `Array.from(map.values())`.
- Remover o import de `cmpModeloCor` (linha 6), que fica sem uso.
- `colunasTamanhos` não muda.

### `src/components/cop/PagamentoOficinasTab.tsx`
- Remover `arr.sort(cmpModeloCor);` (linha 226).
- Remover o import da linha 19, porque esse é o único uso.

### `src/components/cop/PedirUrgenciaDialog.tsx`
- Linha 46: remover o `.sort(cmpModeloCor)`.
- Linha 13: o import fica `import { type PecaSolicitada } from "@/lib/pedidos";`.

## Fora do escopo
- `pedidos.ts`, `cop-saldos.ts`, `RomaneioTab.tsx` e `DashboardCopTab.tsx` não serão tocados.
- Nenhuma migração e nenhum dado alterado.

## Verificação
- Busca confirmando que não sobra `cmpModeloCor` nos três arquivos.
- Typecheck com o resultado mostrado.
- A conferência visual na tela (PDF, Pagamentos e urgência) não será feita, a menos que você peça.
