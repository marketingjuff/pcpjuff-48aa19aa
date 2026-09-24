# KPI PCP — blocos por etapa + pop-up de pedidos em todo número

Só frontend. Nenhuma migração, nenhum SQL, nenhuma alteração de banco. `src/lib/cop-saldos.ts` e `src/lib/pedidos.ts` intocados.

## Allowlist
- `src/lib/kpi-pcp.ts` (alterado)
- `src/components/kpi/KpiPcpTab.tsx` (alterado)
- `src/components/kpi/KpiPcpDrill.tsx` (novo — pop-up de pedidos)
- `src/styles.css` (só tokens de cor dos blocos)

## 1. Pop-up de pedidos (todo número clicável)
- Um único componente `Dialog` (em cima da tela, nunca expansão no card) recebe: título, lista de linhas e qual coluna soma.
- Colunas padrão: Nº do pedido · Peças · Batidas da pessoa (quando for card de batidas) · Datas da etapa (início → fim) · Dias úteis que levou · marca "dividido" na linha quando o número vem de rateio.
- Rodapé com a soma da coluna; a soma é calculada a partir das mesmas linhas que geram o card, então sempre bate com o número clicado.
- Respeita todos os filtros do topo (período, contar pelo quê, vendedor, tipo de estampa, pessoa).
- Clicáveis: todos os cards e células de tabela que contam pedidos, peças ou batidas (Resumo, batidas, Quem fez o quê, Planejado vs. Real por etapa, faixas de tempo, mês a mês, erros, correções, datas adiadas, entraram × saíram, situação de agora). Médias e percentuais abrem os pedidos que entraram na conta.

## 2. Reorganização por etapa
Blocos separados, cada um com faixa de cor própria (tons suaves: Geral roxo, Arte azul, DTF laranja, Silk verde, Acabamento rosa, Expedição cinza-azulado).

- **Geral**: Quantidade de pedidos, Peças produzidas, Tempo médio do pedido, Entregas no prazo, Atraso médio, Pedidos que precisaram refazer peça, Entraram × Saíram, A data que a gente promete, Tempo médio mês a mês, Quanto tempo os pedidos levaram, Situação de agora, e as tabelas consolidadas: Planejado vs. Real (todas as etapas), Onde o erro aconteceu, Correções feitas depois, Peças por pessoa por dia (tabela completa).
- **Arte**: Planejado vs. Real da Arte, quem revelou tela, erros da área Arte, correções da aba Arte.
- **DTF**: batidas DTF, batidas por peça DTF, peças DTF (parte DTF de "Peças por tipo de estampa"), batidas DTF mês a mês, quem bateu DTF, quem cortou DTF, peças por pessoa por dia de DTF, Planejado vs. Real DTF, erros e correções DTF.
- **Silk**: mesmo formato do DTF, com os dados de Silk. "Silk e DTF" aparece nos dois blocos com a legenda dizendo isso.
- **Acabamento**: quem fez o acabamento, quem conferiu, peças por pessoa por dia do acabamento/conferência, Planejado vs. Real, erros e correções.
- **Expedição**: Planejado vs. Real e situação da expedição.
- Linguagem de chão de fábrica mantida, frases de apoio atuais preservadas; nada de termos técnicos.

## Detalhes técnicos
- `kpi-pcp.ts`: cada função passa a devolver também os pedidos por trás de cada número (`ids` / linhas com a contribuição de cada pedido, incluindo `rateado: boolean`), sem mudar os cálculos atuais. Filtros por etapa derivados das funções já existentes (`porPessoa`, `tempoBloco`, `retrabalho`, `estamparia`).
- Dias sempre por `diasUteisEntre` + feriados.
- `Bloco` ganha prop `etapa` para a cor; tokens `--etapa-*` em `src/styles.css`.
- Final: typecheck + diff dos arquivos da allowlist.
