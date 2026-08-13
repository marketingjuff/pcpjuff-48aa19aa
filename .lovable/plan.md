# KPI PCP — "Planejado vs. Real" + Quem fez o quê por batidas

Dois ajustes, apenas em `src/lib/kpi-pcp.ts` e `src/components/kpi/KpiPcpTab.tsx`. Sem migração de banco, sem coluna nova.

## Mudança 1 — Bloco de tempos passa a comparar plano com execução

Hoje o bloco "Onde o tempo está indo" mede o plano contra o próprio plano. Passa a comparar o prazo planejado com o que a produção levou de fato.

### `src/lib/kpi-pcp.ts`
- Helpers internos (não exportados): `arteLiberouDtf` (maior entre `dtf_executado` e `dtf_cortado_data`, só se ambos existirem), `arteLiberouSilk` (`fotolito_executado`), `arteLiberou` e `fimEstamparia` — ambos considerando só os lados aplicáveis via `tipoIncluiDTF`/`tipoIncluiSilk`; `Lisa` fica fora.
- Helper de percentil 80: índice `Math.ceil(0.8 * n) - 1` com clamp.
- Nova interface `EtapaTempo` com `etapa`, `n`, `planejadoMedio`, `realMedio`, `diferenca`, `realP80`, `amostraPequena` (`n < 5`).
- `tempoBloco(regs, feriados)` mantém nome e assinatura; passa a devolver `etapas: EtapaTempo[]`, `maiorFolga`, `gargalo` (ambos ignorando etapas com `n < 5`), `cobertura { elegiveis, total, perc }`, além de `porMes` e `faixas` inalterados.
- Etapas fixas na ordem Arte, Estamparia DTF, Estamparia Silk, Acabamento, Expedição, com os pares planejado/real definidos no prompt. Pedidos com `refacoes` não vazio ficam fora do cálculo por etapa (mas seguem em `porMes`, `faixas` e no denominador da cobertura). Cada etapa só conta o pedido quando as quatro datas existem. Tudo em dias úteis via `diasUteisEntre`.

### `src/components/kpi/KpiPcpTab.tsx`
- Bloco 4 renomeado para **Planejado vs. Real**, com o texto de apoio pedido.
- Linha de cobertura ("X de Y pedidos ... (Z%)"), em amarelo com aviso extra quando abaixo de 50%.
- Dois cartões `Kpi`: "Onde sobra mais prazo" e "Etapa mais demorada".
- Tabela Etapa | Planejado | Real | Diferença | Sugestão (P80) | Pedidos, com sufixo " d", sinal explícito na diferença (verde positivo, vermelho negativo), P80 arredondado para cima, e `—` + "(poucos)" quando a amostra é menor que 5.
- "Tempo médio do pedido mês a mês" e "Quanto tempo os pedidos levaram" ficam idênticas.

## Mudança 2 — Silk e DTF medidos por batidas

### `src/lib/kpi-pcp.ts`
- `LinhaPessoa` ganha `batidasEstimadas: boolean`, marcado quando houve rateio de batidas entre mais de uma pessoa.
- `porPessoa` mantém nome/assinatura; ordena por batidas nos campos `quem_bateu_silk` e `quem_bateu_dtf` e por peças nos demais. `estimado` e `dtf_pessoas_qtd` seguem como estão.

### `src/components/kpi/KpiPcpTab.tsx`
- Nos dois cards de batidas: colunas Pessoa | Pedidos | Batidas (sai a coluna Peças), aviso condicionado a `batidasEstimadas` com o texto "Batidas divididas igualmente entre quem bateu o pedido.", `colSpan` 3.
- Os outros quatro cards e o card "Peças por pessoa por dia" não mudam.
