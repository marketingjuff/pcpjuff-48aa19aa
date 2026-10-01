# Nova aba "KPI COP e MAP" no módulo KPI

Só leitura. Nenhuma migração, nenhum SQL, nada em `supabase/migrations/`. Nenhuma tela de COP ou MAP é alterada.

## Arquivos (exatamente 5)
Novos: `src/lib/kpi-cop-map.ts`, `src/components/kpi/KpiCopMapTab.tsx`, `src/components/kpi/KpiCopMapDrill.tsx`
Alterados: `src/routes/_authenticated/kpi.tsx`, `src/lib/permissoes.ts`
Protegidos e intocados: `cop-saldos.ts`, `cop.ts`, `map.ts`, `pedidos.ts`, `kpi-pcp.ts`, `KpiPcpTab.tsx`, `KpiPcpDrill.tsx`, `PecasPerdidasEditor.tsx`, `admin.functions.ts`, `schema-extras.ts`, `src/components/cop/*`, `src/components/map/*`, `package.json`.

Conferi que já existem: `isOficinaInterna` (cop.ts), `useEstoquePecas` (map.ts), `periodoDoPreset`/`periodoAnterior`/`PresetPeriodo` (kpi-pcp.ts), `corHex`/`corTextoSobre` (PecasPerdidasEditor.tsx), tipos `HistoricoRecebimento` (`parcial|completo`), `HistoricoPerda` (`perda|correcao_perda|estorno_perda`, `total` em delta), `MapEstoqueCorte`, entrada `kpi.pcp` em permissoes.ts.

## 1. `src/lib/kpi-cop-map.ts` — todo o cálculo
- Tipos `KpiCopMapFiltro` (`de`, `ate`, `oficinaId`, `modelo`, `cor`; `"todos"` neutro) e `DrillLinhaCop` (`id`, `rotulo`, `oficina`, `modelo`, `cor`, `tamanho`, `qtd`, `metros`, `valor`, `inicio`, `fim`, `dias`, `nota`).
- `mediana` e `p80` locais.
- Funções `blocoCorte`, `blocoTecido`, `blocoCostura`, `blocoDinheiro`, `blocoPontaAPonta`; cada número volta junto com as linhas que o formaram (o total do popup é a soma dessas mesmas linhas).
- Datas por bloco: Corte `execucao_corte`; Tecido `data` de cada corte; Envio `data_saida_oficina`; Recebimento `em` de cada evento (fallback `data_recebimento` + `pecas_recebidas` quando o histórico está vazio); Perdas `em` de cada evento, somando correção e estorno como ajuste do delta (fallback `perdas`); Dinheiro `pagamento_pago_em`.
- Filtro de oficina/modelo/cor aplicado no nível da linha de peça; no tecido, modelo vem do COP de origem, cor da peça de tecido.
- Dias sempre por `diasUteisEntre` + feriados. Ordem canônica por `REFACAO_MODELOS`/`REFACAO_CORES`/`REFACAO_TAMANHOS`.
- Rótulos via `formatCopNumero`/`rotuloRomaneio`; peças via `totalPecasCop`.

## 2. Blocos (cards conforme o pedido)
- **Corte (verde)**: 11 cards, incluindo "Fila de corte agora" (ignora período, por status de `STATUS_CORTE`, dias corridos desde a última data preenchida).
- **Tecido (amarelo)**: metros, por cor, por modelo rateado com selo "estimativa" + frase explicando, por modelo só de COPs de modelo único com selo "número exato", rendimento, peças abertas, peças que zeraram (data do último corte). COP inexistente: soma no total e por cor, aparece no popup como "COP não encontrado", fora de modelo.
- **Costura (verde escuro)**: 10 cards; oficina interna entra no volume; card 10 só com oficina interna.
- **Dinheiro (teal)**: só oficinas externas (rodapé avisa); custo por modelo ignora modelos sem valor e lista quantas peças/quais modelos ficaram sem valor; liberado e não pago ignora período.
- **Ponta a ponta (cinza)**: tempo total de risco até última chegada (só COPs completados no período) e funil de 5 números.
- Toda frase em linguagem de chão de fábrica ("metade dos casos ficou abaixo disso", "8 em cada 10 casos ficaram até aqui"); rodapé com a data usada; cor sempre em chip; pt-BR, metros com 1 casa, R$ com 2; tabelas longas com `.tbl-congelada max-h-[70vh]`.

## 3. `KpiCopMapTab.tsx`
Carrega `cops` e `oficinas` com `useQuery` (padrão do `DashboardCopTab.tsx`), `useEstoquePecas()` e `useFeriados()`. Topo: presets Mês / Mês passado / 90 dias / Ano / Livre, filtros de oficina, modelo, cor e chave de comparar com o período anterior (variação % nos cards principais). Salva em `localStorage` `kpi:copmap:filtros` (lido em `useEffect`). Cards com faixa colorida no mesmo visual do KPI PCP; nenhuma conta na tela. Período vazio mostra zero ou traço.

## 4. `KpiCopMapDrill.tsx`
Dialog próprio no formato do drill do PCP (título, frase de apoio, barra de total), colunas ligadas por `colunas`: COP, Oficina, Modelo, Cor (chip), Tamanho, Qtd., Metros, Valor, Início, Fim, Dias úteis, Obs. Não importa o drill do PCP.

## 5. `permissoes.ts` e `kpi.tsx`
- Uma linha após `kpi.pcp`: `{ key: "kpi.cop_map", modulo: "kpi", tabValue: "copmap", label: "KPI COP e MAP", nivelConfiguravel: false }`.
- `kpi.tsx`: import do `KpiCopMapTab` e o bloco `montada("copmap") && pode("kpi.cop_map")` depois do bloco `pcp`. Mais nada.

## Final
Typecheck (`tsgo`) + diff completo dos 5 arquivos.
