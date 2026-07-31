# FASE 1 — Banco de dados (Importação Olist + Painel de Indicadores)

Apenas a FASE 1. Nada de parser, tela ou painel nesta etapa.

## O que será criado

Quatro tabelas novas, todas restritas a administradores:

1. **olist_import_lotes** — registro de cada importação (empresa, nome do arquivo, quantos .xls lidos, totais de linhas/pedidos/itens, quem e quando importou).
2. **olist_pedidos** — um registro por pedido por lote (append-only): número, empresa, datas, contato, CPF/CNPJ, situação, vendedor normalizado + original, descontos (valor, percentual, texto original), frete, despesas. Sem UNIQUE em `numero_pedido`, pois o mesmo pedido reaparece em lotes diferentes.
3. **olist_itens** — um registro por linha do arquivo: descrição original, produto_olist, cor, tamanho, qtd, valor unitário, desconto do item, `is_servico`. O modelo NÃO é gravado — é resolvido na leitura via `olist_produto_map`, para que corrigir um mapeamento corrija todo o histórico.
4. **olist_pedidos_excluidos** — pedidos retirados da análise (`numero_pedido` UNIQUE, motivo, quem/quando). Única tabela com DELETE permitido, para a reversão por botão do admin.

## Detalhes técnicos

- 1 migration nova em `supabase/migrations/` — estritamente aditiva: apenas `CREATE TABLE`, `CREATE INDEX`, `GRANT`, `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`. Nenhum DROP, TRUNCATE, DELETE em massa ou alteração de tabela existente.
- Índices: `olist_pedidos` em `numero_pedido`, `lote_id`, `data`, `empresa`; `olist_itens` em `numero_pedido`, `lote_id`, `produto_olist`.
- FKs de `olist_pedidos.lote_id` e `olist_itens.lote_id` para `olist_import_lotes(id)`.
- GRANTs no padrão do projeto: `authenticated` + `service_role` nas quatro tabelas.
- RLS habilitada nas quatro. Políticas usando `public.has_role(auth.uid(), 'admin'::public.app_role)`:
  - SELECT e INSERT nas quatro tabelas;
  - DELETE apenas em `olist_pedidos_excluidos`;
  - nenhuma política de UPDATE em nenhuma delas.
- Sem trigger de `updated_at` (não há coluna `updated_at`, nada é atualizado).
- Após a migration, os tipos do banco (`src/integrations/supabase/types.ts`) são regenerados automaticamente.

## Arquivos protegidos — intocados nesta fase

`src/lib/cop-saldos.ts`, `src/lib/estoque-olist.ts`, `src/lib/pedidos.ts`, `src/lib/cop.ts`, `src/lib/map.ts`, `src/components/cop/AlimentacaoEstoqueTab.tsx` e as migrations já existentes.

## Observações para as fases seguintes (não executadas agora)

- Descompactação do zip: `jszip` já está no projeto (`^3.10.1`) e `xlsx` também — não será necessária dependência nova na FASE 2.

Ao concluir a FASE 1, paro e apresento o plano da FASE 2.
