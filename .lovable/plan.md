## Objetivo

No popup que abre ao clicar num número da aba **Disponível** (COP), mostrar também **todos os COPs que possuem essa peça**, além do que já aparece hoje, e alargar o diálogo.

## Situação atual

`src/components/cop/FaltaPecaPopup.tsx` hoje mostra duas colunas:
- **Esquerda:** "Romaneios em oficina" — apenas COPs que passam por `copAtivoEmOficina` (ou seja, já saíram para oficina). COPs em "Aguardando Risco", "Aguardando Corte", "Cortado" etc. não aparecem.
- **Direita:** Pedidos com falta dessa peça.
- Largura: `max-w-[960px]`.

## Mudanças

1. **Largura do diálogo**
   - `FaltaPecaPopup.tsx`: `max-w-[960px]` → `max-w-[1280px] w-[95vw]`.

2. **Nova seção "COPs com esta peça"**
   - Adicionar terceira lista mostrando **todos os COPs não finalizados/não pagos** que contêm a peça (modelo·cor·tamanho) em `pecas`, independentemente de estarem em oficina.
   - Filtro: `c.status !== "Finalizado"` e `(c as any).pagamento_status !== "pago"` (mesma regra usada em `calcEmProducao`).
   - Para cada COP mostrar: rótulo (`rotuloRomaneio`), status atual, oficina (se houver), quantidade da peça no COP, quantidade recebida, saldo, e data de saída (se houver).
   - Ordenar por rótulo.
   - Link continua abrindo `/cop?tab=romaneio&copId=...` em nova aba.

3. **Layout**
   - Passar de grid 2 colunas para **grid 3 colunas** em `md:` (`md:grid-cols-3`): "COPs com esta peça" | "Romaneios em oficina" | "Pedidos com falta". Manter empilhado no mobile.
   - Manter a seção "Romaneios em oficina" existente sem alterações de lógica (é um subconjunto útil e distinto).

## Arquivos afetados

- `src/components/cop/FaltaPecaPopup.tsx` (único arquivo alterado).

## Fora de escopo

- Sem mudanças de banco, sem mudanças em `DisponivelTab.tsx`, sem alterar cálculos de saldo.
