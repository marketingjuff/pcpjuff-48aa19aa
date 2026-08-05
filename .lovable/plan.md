# SUP — Monitor de Preços, anulação de registro e log de auditoria

Escopo exatamente o do prompt: nada fora da lista de arquivos permitidos é tocado.

## 1. Migração (nova, só aditiva)
- `sup_preco_historico`: `ADD COLUMN` `anulado`, `anulado_por`, `anulado_em`, `anulado_motivo`.
- `CREATE TABLE sup_audit_log` no mesmo padrão de `cop_audit_log`/`map_audit_log`, com os 4 índices, `GRANT SELECT` para `authenticated`, `GRANT ALL` para `service_role`, RLS ligada e policy de SELECT só para admin.
- Gatilhos `AFTER INSERT OR UPDATE OR DELETE` reaproveitando a função existente `public.log_generic_change()` em: `sup_fornecedores` (`razao_social`), `sup_produtos` (`nome`), `sup_fornecedor_produtos` (`produto_id`), `sup_preco_historico` (`fornecedor_produto_id`), `sup_produto_grupos` (`nome`), `sup_pedidos_compra` (`numero`), `sup_pedido_itens` (`pedido_id`), `sup_comissoes` (`competencia`).
- Nomes confirmados no schema: `sup_pedidos_compra`, `sup_pedido_itens`, `sup_comissoes` existem com essas colunas. Nenhum `DROP`, `DELETE`, `RENAME`, nenhuma policy removida, nenhuma linha alterada.

## 2. `src/lib/sup.ts`
Só os 4 campos novos no type `SupPrecoHistorico`. Nenhuma função alterada.

## 3. `ProdutosTab.tsx`
No histórico de preço abaixo da tabela: registros anulados saem dos cálculos, aparecem riscados com badge cinza "Anulado" + motivo, e checkbox "Mostrar anulados" (desmarcado por padrão). Mais nada muda.

## 4. `AlteracoesPrecoTab.tsx` (passa a ser sub-aba)
- Remove da interface o fluxo de revisão (botões Revisada/Contestar, mutation `marcar`, coluna e filtro de Revisão, contador de pendentes). `status_revisao` continua no banco; `ComissoesTab.tsx` não é tocado.
- O bloco "Comparativo entre fornecedores" sai daqui inteiro (vai para a sub-aba própria).
- Recebe `de`/`ate` por prop; Direção, Tipo e "Mostrar anulados" seguem locais.
- Coluna **Tipo** (Tabela/Negociado) com filtro, destaque em "Quem alterou" e o texto de apoio pedido.
- **Anular** (só admin): AlertDialog com motivo obrigatório (mín. 3 caracteres); grava `anulado`, `anulado_por`, `anulado_em`, `anulado_motivo`; devolve `preco_anterior` para `sup_fornecedor_produtos.preco_tabela` ou `preco_negociado` conforme o `tipo`. Habilitado apenas no registro mais recente não anulado daquele `fornecedor_produto_id` + `tipo`; nos outros, desabilitado com tooltip. Antes de confirmar, checa `sup_pedido_itens.preco_historico_id` em PCs fora de rascunho/cancelado e exibe aviso âmbar com os números — sem bloquear. Sem desanular. Nenhum delete.

## 5. Nova aba **Monitor de Preços**
- `MonitorPrecosTab.tsx`: container com filtros De/Até no topo e `Tabs` — Registro de alterações | Comparativo | Economia por troca | Oscilação de preço. Trocar de sub-aba preserva o período.
- `ComparativoFornecedoresTab.tsx`: recebe o bloco atual com a mesma lógica, mais "Última compra" e "R$/un. ref na última compra" por fornecedor, usando `useSupPedidos`/`useSupPedidoItens` importados de `PedidosCompraTab.tsx` (sem alterá-lo).
- `EconomiaTrocaTab.tsx`: relatório com as fórmulas do prompt (referência = última compra do mesmo grupo em fornecedor diferente), encarecimento em vermelho com valor negativo, rodapé de totais, exportação CSV `;` com decimal por vírgula. Aviso "Indicador de referência. Não entra na apuração de comissão."
- `OscilacaoPrecoTab.tsx`: LineChart recharts, modos "por item equivalente (grupo)" e "por produto", série mensal com arrasto do último preço vigente, opcional linha tracejada de preço negociado, ignora anulados, resumo por fornecedor com amplitude %, aviso âmbar abaixo de 12 meses e estado vazio. Somente leitura.

## 6. Histórico SUP (auditoria)
- `audit-log.functions.ts`: aceita `"sup"` e mapeia para `sup_audit_log` (busca por `identificador`, `assertAdmin` mantido).
- `AuditLogView.tsx`: `area` aceita `"sup"` e novas chaves em `TABELA_LABELS`.
- `HistoricoSupTab.tsx`: wrapper de `AuditLogView area="sup"`.
- `audit-labels.ts`: só acrescenta os rótulos do SUP.
- `sup.tsx`: "Alterações de Preço" vira "Monitor de Preços" (com `alteracoes-preco` redirecionando para a nova aba, preservando links e localStorage) e ganha "Histórico SUP" no fim, só para admin.

## Fora de escopo
`PedidoCompraDialog.tsx`, `ComissoesTab.tsx`, `DashboardSupTab.tsx`, `PedidosCompraTab.tsx`, `FornecedoresTab.tsx`, `DepartamentosTab.tsx`, `SupConfig*`, `cop-saldos.ts`, `log_generic_change()` e todo PCP/COP/MAP/KPI.
