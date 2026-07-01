## Correção — Aba Disponível (COP)

**Problema:** peças recebidas da oficina (`cops.pecas_recebidas`) não descontam o Disponível. Baixa via `pecas_completadas_log` gera desconto duplicado.

**Fórmula nova:** `Disponível = produção − faltantes − recebido − perdas`
(`baixado` sai — já está contido em `recebido`).

### Alterações

**`src/lib/cop-saldos.ts`**
- Remover/deprecar `calcBaixado`.
- Adicionar `calcRecebido(cops)`: soma `cops[].pecas_recebidas[].qtd_recebida` agrupado por `modelo|cor|tamanho`, para todos os COPs.
- Atualizar `calcDisponivel(producao, faltantes, recebido, perdas)` — trocar a 3ª entrada (baixado → recebido). Mantém subtração e união de chaves.

**Consumidores** (substituir chamada `calcBaixado(pedidos)` por `calcRecebido(cops)` e renomear var local `baixado`→`recebido`):
- `src/components/cop/DisponivelTab.tsx`
- `src/components/cop/DashboardCopTab.tsx` (se usar)
- Qualquer outro tab (`FaltaPorPedidoTab`, `OficinasHojeTab`) que chame `calcBaixado`/`calcDisponivel` — verificar via grep e ajustar.

### Banco
Nenhuma migração. Campo `cops.pecas_recebidas` já existe e é preenchido pelo `EntregaRomaneioDialog`.

### Validação
Rodar mentalmente o exemplo da tabela (Camiseta Preta M, corte 100, pedido 30) e conferir os quatro estados: 70 → 10 → 40 → 0.
