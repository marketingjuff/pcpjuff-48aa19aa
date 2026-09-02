# Mover pedido entre Juff Store e Juff Custom com um clique

Hoje um pedido cai na aba Store automaticamente quando algum item tem "Juff Store" na descrição e a empresa é JOKE. Não existe forma de corrigir um pedido que veio para lá por engano. A ideia é criar uma exceção manual, reversível, feita direto no pop-up de detalhamento (o mesmo que abre ao clicar no vendedor).

## Como vai funcionar

1. No KPI Juff Store, clicar no vendedor (ex.: "Mirela") abre a lista de pedidos como hoje. Cada linha ganha um botão **"Mover para Custom"**.
2. Um clique move o pedido inteiro (peças, faturamento, frete, desconto) para o Juff Custom. O painel recarrega e os números dos dois lados se ajustam na hora.
3. No KPI Juff Custom, o pedido movido aparece com o botão **"Voltar para Store"**, então nada é definitivo — dá para desfazer quando quiser.
4. O mesmo botão aparece em qualquer detalhamento de pedidos das duas abas (vendedor, empresa, cliente, mês), porque é a mesma tela de pop-up.
5. A exceção fica salva no banco: vale para todos os usuários, sobrevive a nova importação da Olist e continua valendo depois de recarregar a página.
6. Somente admin e gestor podem mover; para os outros o botão não aparece.
7. O rodapé do pop-up deixa de dizer "somente leitura" quando o botão está disponível, e passa a explicar em uma linha o que o botão faz.

## Detalhes técnicos

**Migração** — nova tabela `kpi_pedido_escopo`:
- `numero_pedido text primary key`, `escopo text not null check (escopo in ('custom','store'))`, `definido_por uuid`, `definido_em timestamptz default now()`.
- `GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_pedido_escopo TO authenticated; GRANT ALL TO service_role;`
- RLS ligada: SELECT para `is_team_member()`; INSERT/UPDATE/DELETE só para `has_role(auth.uid(),'admin')` ou `'gestor'`.

**`src/components/kpi/IndicadoresTab.tsx`**
- A query base passa a ler `kpi_pedido_escopo` e devolver `overrides: Map<string, "custom"|"store">`.
- No `useMemo` de `base`, `ehStorePedido(p)` consulta primeiro o override; sem override, mantém exatamente a regra atual (`pedidosStore.has(...) && empresa === "JOKE"`).
- Mutação `definirEscopoPedido(numero, destino)`: `upsert` quando o destino difere da classificação automática, `delete` quando volta a coincidir (o registro deixa de ser necessário). No sucesso, invalida `["indicadores-olist","base"]` e mostra toast.
- Os payloads de drill de pedido recebem `acaoEscopo` (ver abaixo) apenas quando o usuário é admin/gestor.

**`src/lib/indicadores-drill.ts`**
- `DrillPayload` ganha `acaoEscopo?: { chaveNumero: string; escopoAtual: "custom" | "store"; ehStoreAuto: (numero: string) => boolean; onMover: (numero: string) => void; pendente?: string | null }`.
- `drillPedidos` já traz `numero_pedido` na linha; nenhuma outra função de drill muda.

**`src/components/pcp/IndicadorDrillDialog.tsx`**
- Quando `acaoEscopo` existe, renderiza uma coluna extra "Escopo" à direita com um botão pequeno por linha. No Store o rótulo é "Mover para Custom"; no Custom só aparece para pedido cuja classificação automática é Store, com o rótulo "Voltar para Store". A coluna extra não entra no CSV nem no rodapé de soma.

Nada muda nos cálculos, filtros ou PDFs além do recorte de escopo já existente.
