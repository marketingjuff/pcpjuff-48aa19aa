# Ajustes: Pagamento, Perdas, Falta por Pedido e Expedição

Frontend-only. Sem migração de banco.

## 1. `src/components/cop/PagamentoOficinasTab.tsx` — Datas de Liberação e Vencimento
- Adicionar helper local `calcVencimento(liberadoEm, feriados)` reutilizando `addDiasUteis(new Date(liberadoEm), 5, feriados)`.
- Na tabela "COPs elegíveis": adicionar duas colunas após "Pagamento":
  - **Liberação**: `pagamento_liberado_em` em pt-BR ou "—".
  - **Vencimento**: data calculada em pt-BR ou "—"; se `isPagamentoAtrasado`, texto vermelho.
  - Para status "pago", mostrar as datas (histórico) sem destaque de atraso.
- No card de detalhe do COP selecionado (próximo à "Liberado em {data/hora}"), acrescentar "Vencimento: dd/mm/aaaa" (vermelho se atrasado).
- Não tocar em lógica de liberação/pagamento/valores.

## 2. `src/components/cop/PerdasTab.tsx` — remover coluna Status
- Remover `<th>Status</th>` e `<td>{cop.status}</td>` da tabela "Perdas registradas em romaneios".
- Ajustar `colSpan` do estado vazio de 8 → 7.

## 3. `src/components/cop/FaltaPorPedidoTab.tsx` — coluna Orçamento compacta
- `<th>` e `<td>` do Orçamento: `w-24 max-w-[90px]`, remover `whitespace-nowrap`, usar `break-words`.
- Número do orçamento em uma `<div>`; "Olist XXXX" (quando existir) em segunda `<div>` com `text-[10px] text-muted-foreground`.
- Sem mudanças em rowSpan, ordenação, popups ou "Dar baixa".

## 4. `src/components/pcp/ExpedicaoTab.tsx` — NF editável
- Adicionar `const { names: nfOpcoes } = useAppList("nf")`.
- Substituir o `ReadOnlyField` de "Nota Fiscal Emitida?" por um `Select` no mesmo slot do grid, ligado a `form.nf_emitida`.
- Incluir `nf_emitida: form.nf_emitida ?? null` nos payloads de `handleSave` e `handleFinalizar`.
- Manter regras de edição por perfil já existentes.

## Escopo
Somente esses 4 arquivos. Zero migração.
