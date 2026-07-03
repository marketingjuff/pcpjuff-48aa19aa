
## MAP – Matéria Prima (Programação de Fios)

Novo módulo amarelo (`/map`) espelhando a estrutura do COP. Fluxo Fio → Malharia → Tinturaria em cascata. Escopo desta fase: apenas fios. Nada de PCP/COP é alterado além dos 4 arquivos listados. **A migration do banco já foi aprovada e executada** — as tabelas `map_*` estão criadas com RLS/GRANTs.

## Arquivos

**Novos**
- `src/lib/map.ts` — tipos (`MapProducao`, `MapEntregaMalharia`, `MapProgramacaoTinturaria`), helpers (`calcQuebra`, `sumPecasEntregas`, `sumPecasProgramadas`, `podeFinalizar`), hook `useKgPorPeca` (lê `map_config`).
- `src/routes/_authenticated/map.tsx` — rota amarela; header "MAP Juff / Matéria Prima"; `MacroSwitch active="map"`; tabs `programacao` | `finalizados`; `bg-yellow-50/60`; persistência da tab em `localStorage` chave `map:tab`; search params `tab`, `prodId` (padrão espelhado do `cop.tsx`).
- `src/components/map/ProgramacaoFiosTab.tsx` — tabela flat compacta seguindo o padrão visual de `OficinasHojeTab` (text-[12.5px], header sticky, botões Expandir tudo / Recolher tudo, contadores). Prods agrupados por `data_pedido` (cabeçalho por bloco). Linha-resumo do Prod com labels pequenos (Prod, ped, faturar, kg, fornecedor, status, NF, fat, pag). Chevron expande revelando `<MalhariaBlock>` e `<TinturariaBlock>` inline. Botão "Novo pedido". Filtra `finalizado = false`. Realtime nas 3 tabelas invalidando `["map", ...]`.
- `src/components/map/FiosFinalizadosTab.tsx` — mesma tabela, filtra `finalizado = true`, ordena por `finalizado_em desc`, botão "Reabrir" por Prod.
- `src/components/map/NovoProdDialog.tsx` — cria Prod. Pré-sugere `max(numero)+1`, editável. Se o número já existe: confirm inline "Já existe Prod N — deseja continuar?". Sem `UNIQUE` no banco.
- `src/components/map/MalhariaBlock.tsx` — nome da malharia + tabela inline de entregas com edição direta (save no blur/enter, **apenas o campo alterado no update**), botão adicionar entrega, linha discreta de Quebra (`kg_solicitados − Σ kg`, estimativa em peças `÷ kg_por_peca`), botão "Dar baixa" → dialog, badge "Conciliada".
- `src/components/map/TinturariaBlock.tsx` — tabela inline de programações. `kg_enviados = pecas × kg_por_peca` auto-preenchido, mas editável. Contador `X / Y` peças programadas × recebidas da malharia; destaques quando X<Y (falta), X=Y (completo), X>Y (alerta).
- `src/components/map/BaixaQuebraDialog.tsx` — dialog com observação → seta `quebra_conciliada/_em/_por/_obs`.
- `src/components/map/MapConfigPanel.tsx` — cards `KgPorPecaCard`, `FornecedoresFioCard` (kind `map_fio_fornecedor`), `MalhariasCard` (`map_malharia`), `TinturariasCard` (`map_tinturaria`), `AcessoMapCard` (informativo, seguindo o padrão do `AcessoCard` do COP — a concessão da área é feita no card de Usuários já existente).

**Alterados (mínimo cirúrgico)**
- `src/integrations/supabase/schema-extras.ts` — adiciona `"map"` a `AppArea`, `APP_AREAS_GESTOR` e `APP_AREA_LABEL` (`"MAP — Matéria Prima"`). Isso faz o checkbox de área aparecer automaticamente para gestor no card de Usuários.
- `src/lib/app-lists.ts` — adiciona `"map_fio_fornecedor" | "map_malharia" | "map_tinturaria"` ao union `AppListKind`.
- `src/hooks/use-role.ts` — adiciona `useCanAccessMap()` (admin ou gestor com `"map"` em `areas_extras`).
- `src/routes/_authenticated/cop.tsx` — `MacroSwitch`: prop `active` passa a aceitar `"pcp" | "cop" | "map"`; novo botão **MAP** amarelo (`bg-yellow-500 text-white` ativo) visível quando `useCanAccessMap()`.
- `src/routes/_authenticated/configuracoes.tsx` — `validateSearch` aceita `area="map"`; seletor de área ganha o botão MAP (visível quando `useCanAccessMap()`); quando `area==="map"` renderiza `<MapConfigPanel />`.

Não tocar em mais nada — inclusive nenhum arquivo PCP/COP fora dos 4 acima.

## Comportamento

- **Status automático**: setar `nota_fiscal` no Prod dispara update com `{ nota_fiscal, status: 'entregue' }` no mesmo write.
- **Finalizar**: botão habilita quando `status = 'entregue'` E ≥1 entrega de malharia E toda programação de tinturaria com `data_recebimento`, `kg_recebidos`, `pecas_recebidas` preenchidos. Ao clicar, `{ finalizado: true, finalizado_em: now(), finalizado_por: auth.uid() }`.
- **Anti stale-write**: todas as edições inline enviam **apenas o campo alterado**.
- **Vazios exibem "—"**.
- **Unicidade do `numero`**: apenas aviso no dialog (não há `UNIQUE` no banco), conforme aprovado.
- **Query keys**: sempre `["map", ...]`.
- **Realtime**: `postgres_changes` em `map_producoes`, `map_malharia_entregas`, `map_tinturaria_programacoes` invalida `["map"]`.

## Aprovação

Migração de banco já rodou. Falta apenas aprovar a mudança para build mode para eu escrever os arquivos de frontend listados acima.
