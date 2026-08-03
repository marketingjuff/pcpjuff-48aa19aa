# Plano: novo módulo macro KPI (roxo) com KPI Custom, KPI Store e KPI PCP

100% front-end. Nenhuma migração, nenhuma alteração de banco ou RLS.

## 1. Arquivos

**Criados**
- `src/routes/_authenticated/kpi.tsx` — rota `/kpi`, espelhando `map.tsx`: cabeçalho com logo, título "KPI Juff", subtítulo "Indicadores e monitoramento", `MacroSwitch active="kpi"`, botões Configurações (gestor/admin) e Sair; acento roxo onde o MAP usa amarelo. Abas na ordem `importolist`, `custom`, `store`, `pcp`; inicial `custom`; persistência em `localStorage["kpi:tab"]` sincronizada com `?tab=`. Acesso somente admin (`useIsAdmin`): sem permissão → `toast.error("KPI é restrito a administradores.")` + `navigate({ to: "/", replace: true })`. Montagem sob demanda (`tab === "x" && <TabsContent>`), como hoje.
- `src/components/kpi/KpiPcpTab.tsx` — a tela nova (bloco 4).
- `src/lib/kpi-pcp.ts` — funções puras de cálculo, recebendo registros já lidos.

**Movidos (sem mudança de lógica, apenas caminhos de import)**
- `src/components/pcp/IndicadoresTab.tsx` → `src/components/kpi/IndicadoresTab.tsx`
- `src/components/pcp/ImportacaoOlistTab.tsx` → `src/components/kpi/ImportacaoOlistTab.tsx`

**Alterados**
- `src/routes/_authenticated/cop.tsx` — somente `MacroSwitch`: tipo `"pcp" | "cop" | "map" | "kpi"`, botão KPI depois do MAP, ativo `bg-purple-600 text-white`, inativo igual aos outros, visível só para admin.
- `src/routes/_authenticated/index.tsx` — remover os três itens do array `tabs`, os três `TabsContent` e os imports órfãos; adicionar o redirecionamento abaixo.

`src/routeTree.gen.ts` é regenerado pela ferramenta.

## 2. Redirecionamento das abas antigas

No `index.tsx`, antes de decidir a aba: se a aba vinda de `?tab=` **ou** do `localStorage["pcp:tab"]` for `indicadores`, `indicadores_store` ou `importolist`, limpar a chave salva e `navigate({ to: "/kpi", search: { tab }, replace: true })` com o mapa `indicadores → custom`, `indicadores_store → store`, `importolist → importolist`. Nada é renderizado nesse ciclo, então não aparece erro nem aba vazia.

## 3. KPI PCP — cards com o texto exato de tela

Fonte: tabela `pedidos`. Todo prazo em dias úteis (`diasUteisEntre` + `useFeriados`). Reaproveita `produtividadePcp` de `@/lib/indicadores-olist` para tempo por etapa, etapa mais demorada, % no prazo, atraso médio, atrasados, em risco, refações por área e correções por aba. `perda_adesivos` e `qtd_falta_adesivos` não entram em nenhuma contagem de peça.

**Filtros (barra fixa)**: Período com presets (Este mês · Mês passado · Últimos 90 dias · Este ano · Livre) + "Comparar com o período anterior"; "Contar pelo quê" (Data de entrada / Data de saída, padrão entrada, com o texto de apoio pedido); Vendedor; Tipo de estampa (Silk · DTF · Silk e DTF · Lisa); Pessoa.

### Bloco 1 — Resumo do período
| Título na tela | Frase de apoio | Cálculo / campo |
|---|---|---|
| Pedidos finalizados | Pedidos que ficaram prontos no período. | contagem por `finalizado_em` |
| Peças produzidas | Total de peças desses pedidos. | Σ `qtd` |
| Tempo médio do pedido | Da entrada do pedido até ele sair da Juff, em dias úteis. | `entrada_pedido` → `data_saida_juff` |
| Entregas no prazo | De cada 100 pedidos, quantos saíram até a data combinada. | % `data_saida_juff` ≤ `data_entrega` |
| Atraso médio | Quando atrasa, atrasa em média esse tanto de dias úteis. | média dos entregues fora do prazo |
| Pedidos que precisaram refazer peça | Pedidos em que alguma peça teve que ser feita de novo. | % com episódio em `refacoes` |

Variação vs. período anterior em cada card quando a comparação estiver ligada.

### Bloco 2 — Estamparia: quanto foi batido
Batidas de Silk no período (Σ `n_batidas_silk`) · Batidas de DTF no período (Σ `n_batidas_dtf`) · Batidas por peça (Silk) e Batidas por peça (DTF) — frase: "Quanto mais alto, mais trabalhoso foi cada peça. Serve para comparar meses com a mesma quantidade de peças mas trabalho diferente." · Peças por tipo de estampa (Silk · DTF · Silk e DTF · Lisa, quantidade e %) · tabela mês a mês de batidas.

### Bloco 3 — Quem fez o quê
Tabelas por pessoa (pedidos, peças, batidas) para: quem mais bateu Silk, quem mais bateu DTF, quem cortou DTF, quem revelou tela, quem fez o acabamento, quem conferiu. Nomes lidos com `parsePeople`. No DTF, com `dtf_pessoas_qtd` presente usa o número real; sem ele divide igualmente e marca a linha: "Número dividido igualmente — o pedido não registrou quanto cada um fez." Card "Peças por pessoa por dia" — frase: "Média de peças que cada pessoa entregou por dia útil trabalhado." Cada linha abre a lista de pedidos da pessoa, somente leitura.

### Bloco 4 — Onde o tempo está indo
Tempo médio de Arte · Estamparia · Acabamento · Expedição; Etapa mais demorada do período em destaque ("É a etapa que mais segurou os pedidos nesse período."); Tempo médio do pedido mês a mês; "Quanto tempo os pedidos levaram" em faixas até 5 · 6 a 10 · 11 a 15 · mais de 15 ("Mostra se tem pedido demorando muito mais que a média.").

### Bloco 5 — Situação de agora
Título: "Isso aqui é a foto de hoje, não depende do período escolhido." Pedidos parados em esperando Arte · em DTF · em Silk · em Acabamento · em Expedição; Pedidos atrasados; Pedidos vencendo (até 3 dias úteis); Há quanto tempo os pedidos estão na casa ("Se esse número sobe, a fila está crescendo.").

### Bloco 6 — Erros e retrabalho
Peças refeitas (e % das peças produzidas) · Peças perdidas (`perda_pecas` dentro de `refacoes`, e %) · Onde o erro aconteceu (refações por área) · Correções feitas depois (`correcoes_etapa` por aba) · Pedidos reabertos.

### Bloco 7 — A data que a gente promete
Pedidos que tiveram a data de entrega adiada (% e média de dias empurrados, de `historico_data_entrega`) — "Mostra se a data que a gente promete no começo é a data que a gente cumpre no fim." · Entraram × Saíram no período — "Se entra mais do que sai por vários períodos seguidos, a fila está aumentando." · Tempo médio de secagem (`dias_secagem`).

## 4. Cards que eu proponho cortar ou marcar

- **Peças por pessoa por dia**: não existe registro de jornada nem de presença. Vou calcular como peças da pessoa ÷ dias úteis do período em que ela aparece em algum pedido, e marcar o card como número aproximado. Se preferir, corto.
- **Quem fez o acabamento / quem conferiu — batidas**: essas etapas não têm batidas; a coluna sai dessas tabelas (só pedidos e peças).
- **Pedidos parados "em Silk" vs "em DTF"**: derivado de `tipo_estampa` + datas de execução ausentes; um pedido Silk e DTF aparece nas duas listas, e isso fica dito na legenda.

Card sem dado suficiente mostra "—" com a razão curta; nunca `0` nem `NaN`.

## 5. Detalhes técnicos

- `kpi-pcp.ts` exporta funções puras (`resumoPeriodo`, `estamparia`, `porPessoa`, `tempoPorFaixa`, `situacaoAgora`, `retrabalho`, `promessaDeData`) recebendo `PcpDb[]` + feriados, no estilo de `indicadores-olist.ts`.
- A tela usa os mesmos componentes visuais das abas de indicadores (cards, tabelas, drill somente leitura); nenhum componente novo onde o existente resolve.
- Verificação final: typecheck sem erros e nenhum arquivo fora da lista permitida alterado.
