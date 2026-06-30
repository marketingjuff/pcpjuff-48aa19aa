## Escopo
Ajustes 100% front-end no COP. Sem migration. Sem tocar no PCP.

## Arquivos tocados

### `src/routes/_authenticated/cop.tsx`
- Reordenar `TABS`: Dashboard COP → Disponível → Falta por Pedido → **Oficinas Hoje** (novo) → Corte → Romaneio → **Pagamentos** (label) → Perdas.
- Renomear label da aba `pagamento` para "Pagamentos" (value mantém).
- Adicionar `TabsContent` para nova aba `oficinas-hoje`.
- Mudar `tab` inicial se necessário (mantém "corte" ou ajusta para "dashboard" — manter "corte" para não mudar comportamento).

### `src/components/cop/OficinasHojeTab.tsx` (novo)
- Carrega `cops` ativos (status pós-corte, `oficina_id` not null, excluindo `Finalizado` e `pagamento_status = 'pago'`) + `oficinas`.
- Agrupa por oficina. Para cada oficina: lista de romaneios (`rotuloRomaneio`, status, `totalPecasCop`) + total geral somado.
- Reaproveita helpers de `src/lib/cop.ts`.
- Header com contador "X oficinas / Y romaneios / Z peças".
- Título grande no topo (item 7).

### `src/components/cop/RomaneioTab.tsx`
- **Item 1:** Trocar título visível do card de Conferência → "Histórico". Manter textos internos.
- **Item 4:** Em `BuscaPecasBlock`, adicionar colunas Oficina + Carga total da oficina (soma de `totalPecasCop` dos COPs ativos da mesma oficina, mesmo critério da aba Oficinas Hoje). Total repetido por linha do grupo.
- **Item 5:** Novo `<Select>` "Oficina" (opção "Todas" + lista de `oficinas`) ao lado de Status/busca, filtrando a lista principal por `oficina_id`.
- Título grande no topo (item 7).

### `src/components/cop/FaltaPorPedidoTab.tsx`
- **Item 6:** Renderizar valores de falta como negativos (`-N`) nas células de tamanho e Total Geral. Apenas display; o cálculo local permanece. Não tocar em `cop-saldos.ts`.
- **Item 9:** Quando `ancora` muda entre linhas consecutivas, aplicar borda superior mais grossa + `pt-*` extra na primeira linha do novo bloco de data.
- Título grande no topo.

### `src/components/cop/DisponivelTab.tsx`
- **Item 8:** Borda superior mais grossa + leve espaçamento na primeira linha de cada nova Cor.
- Título grande no topo.

### `src/components/cop/DashboardCopTab.tsx`, `CorteTab.tsx`, `PagamentoOficinasTab.tsx`, `PerdasTab.tsx`
- **Item 7:** Adicionar `<h2>` grande no topo de cada um (ex: `text-2xl font-bold mb-4`) com o nome da aba.

## Sem alterações
- `src/lib/cop-saldos.ts` — inalterado (cálculo do Disponível preservado).
- Schema do banco — nenhuma migration.
- PCP — nenhum arquivo tocado.

## Detalhe técnico
- "Carga da oficina" = soma de `totalPecasCop(cop)` para todos os COPs com mesmo `oficina_id`, status pós-corte e não Finalizado/Pago. Helper local compartilhado entre `OficinasHojeTab` e `BuscaPecasBlock` (criar `src/lib/cop-oficinas.ts` com `cargaPorOficina(cops): Map<oficina_id, number>`).

Aprove para eu implementar.