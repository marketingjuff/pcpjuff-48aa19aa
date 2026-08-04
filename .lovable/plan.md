# Módulo SUP (Suprimentos) — plano completo

Novo quinto módulo macro, verde-água (teal), entre MAP e KPI. Isolado: não toca cálculos de COP/MAP/PCP/KPI.

## 1. Permissões

- `schema-extras.ts`: `"sup"` no type `AppArea`, em `APP_AREAS_GESTOR`, label `sup: "SUP — Suprimentos"`. Fora de `APP_AREAS_OPERADOR`.
- `use-role.ts`: novo `useCanAccessSup()` (admin OU gestor com área `sup`). Nenhum hook existente alterado.
- O checkbox "SUP — Suprimentos" aparece automaticamente em Configurações (a tela lê `APP_AREAS_GESTOR`).

## 2. Banco (uma migração nova, só aditiva)

Tabelas criadas: `sup_fornecedores`, `sup_produtos`, `sup_fornecedor_produtos` (único por fornecedor+produto), `sup_preco_historico` (append-only), `sup_pedidos_compra`, `sup_pedido_itens`, `sup_pedido_anexos`, `sup_comissionados`, `sup_comissoes` (único por competência+comissionado), `sup_comissao_itens`, `sup_config` (linha única com 5% e 15 dias), `sup_numeracao`.

Todas com GRANTs, RLS habilitada e políticas via `has_role()`/`has_area()`:
- admin: SELECT/INSERT/UPDATE/DELETE em tudo do SUP.
- gestor com área `sup`: SELECT/INSERT/UPDATE em fornecedores, produtos, fornecedor_produtos, preco_historico (INSERT+SELECT apenas), pedidos, itens, anexos.
- gestor: só SELECT em comissionados, comissoes, comissao_itens, config; UPDATE em `sup_comissoes` apenas para liberar (`a_apurar → a_pagar`), via política com checagem de status.
- DELETE apenas admin. `sup_preco_historico` sem UPDATE/DELETE para gestor.

Storage: bucket `sup-anexos` com políticas de leitura/escrita para quem tem acesso ao SUP.

Função `sup_proximo_numero_pc(p_data date)`: `ano_mes` no formato `26MAI`, upsert incremental em `sup_numeracao`, retorna `PC26MAI-01`. Sem truncar acima de 99. Número gerado só quando o pedido sai de rascunho.

Nenhum DROP, TRUNCATE, DELETE em massa, rename ou alteração de tipo. Nenhuma migração existente tocada.

## 3. Navegação

- `cop.tsx`: somente dentro do `MacroSwitch` — `active` passa a aceitar `"sup"`, `useCanAccessSup()`, `supActive = "bg-teal-500 text-white"`, botão SUP entre MAP e KPI.
- Nova rota `src/routes/_authenticated/sup.tsx` espelhando `map.tsx`: `validateSearch` (tab, pcId, fornecedorId), guarda de acesso com toast + redirect para `/`, header com logo, "SUP Juff / Suprimentos", `MacroSwitch active="sup"`, Configurações e Sair, aba persistida em `localStorage` (`sup:tab`).
- Abas: Fornecedores, Produtos, Pedidos de Compra, Comissões, Dashboard SUP. Só admin vê Alterações de Preço e Configurações SUP.

## 4. Telas

- **FornecedoresTab**: tabela com busca (nome/documento), filtro ativo/inativo, dialog de criação/edição com todos os campos; inativar em vez de excluir.
- **ProdutosTab**: catálogo (nome, categoria, unidade, especificação) + preços por fornecedor do produto selecionado, com adicionar fornecedor. Toda alteração de `preco_tabela` grava histórico novo (`alta` → `pendente`; `baixa`/`inicial` → `revisada`), com motivo e anexo opcionais, aplicada na hora, histórico imutável. Dialog mostra histórico em ordem decrescente.
- **PedidosCompraTab**: lista com número, empresa, fornecedor, data, responsável, comissionado, status, valor negociado, economia; filtros por status, empresa, fornecedor, período, comissionado.
- **PedidoCompraDialog**: cabeçalho completo (empresa Joke/Juff, fornecedor, data, responsável = usuário logado editável, comissionado com opção "Neutro (sem comissão)" e snapshot do percentual, condição de pagamento com "Outros" liberando texto livre, previsão, frete, NF, observações, anexos), itens com preço de tabela puxado do cadastro e congelado no item (+ `preco_historico_id`), desconto global R$ ou %, cadastro rápido de produto sem sair da tela, recebimento item a item, status transitando `recebido_parcial`/`recebido` (com `data_recebimento_total`), cancelamento com motivo obrigatório, botão de PDF.
- **ComissoesTab**: seletor de competência, apuração idempotente ("Apurar competência") respeitando elegibilidade (comissionado, status recebido/pago, recebimento total + carência, economia > 0, sem itens contestados), gestor libera, admin paga, ajustes/estornos em `ajuste_valor`. Comissionado do PC travado na interface após apuração (só admin altera).
- **AlteracoesPrecoTab** (admin): altas com pendentes primeiro, variação %, quem/quando/motivo/anexo, ações Marcar como revisada / Contestar.
- **SupConfigTab** (admin): percentual padrão, dias de carência, gestão dos comissionados e percentuais individuais.
- **DashboardSupTab**: filtro de período e empresa; economia do período, comissão por pessoa, gasto por categoria, evolução de preço por produto, ranking de fornecedores, maiores variações de preço, pedidos em aberto por status, comparativo Joke × Juff — com `recharts` (nenhuma biblioteca nova).

## 5. Cálculo e PDF

`src/lib/sup.ts` com funções puras: economia por item (nunca negativa), subtotal negociado, desconto global, economia total (nunca negativa), total do pedido, custo total com frete, comissão prevista. Aviso na tela quando o negociado passa do de tabela. Frete fora da economia/comissão. Neutro exibe economia mas não gera comissão.

`src/lib/sup-pc-pdf.ts` no padrão de `romaneio-pdf.ts` (janela de impressão): logo, número, empresa, fornecedor, datas, condição de pagamento, itens com quantidade/unidade/preço negociado, total, frete e observações. Sem preço de tabela, economia ou comissão.

## Arquivos

Criar: migração, `src/routes/_authenticated/sup.tsx`, `src/lib/sup.ts`, `src/lib/sup-pc-pdf.ts` e os 8 componentes em `src/components/sup/`.

Modificar apenas: `src/integrations/supabase/schema-extras.ts`, `src/hooks/use-role.ts`, `src/routes/_authenticated/cop.tsx` (só o `MacroSwitch`).
