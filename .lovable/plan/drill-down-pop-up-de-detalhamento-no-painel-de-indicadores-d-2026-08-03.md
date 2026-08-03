# Drill-down (pop-up de detalhamento) no Painel de Indicadores do PCP

Tornar todo número agregado da aba **Indicadores** clicável, abrindo um pop-up somente-leitura com as linhas individuais que formam aquele número, mais um rodapé de conferência que compara a soma das linhas com o indicador clicado.

Sem migração de banco. Sem nova consulta ao backend. Sem alterar cálculo existente nem o PDF.

## Arquivos

Novos:
- `src/lib/indicadores-drill.ts` — funções puras que montam o detalhamento (uma por família de indicador), tipo `DrillPayload`, tipo `PcpDrill`.
- `src/components/pcp/IndicadorDrillDialog.tsx` — dialog genérico: busca, tabela com cabeçalho congelado, formatação por tipo de coluna, "Copiar CSV", rodapé de conferência, corte em 300 linhas.
- `src/components/pcp/ValorDrill.tsx` — wrapper que torna um número clicável (lazy: payload só é calculado no clique); valores zerados/`—`/vazios ficam texto puro.

Editado (só este):
- `src/components/pcp/IndicadoresTab.tsx` — acrescentar `id, orcamento, vendedor, tipo_estampa, data_saida_juff, reaberto, status_pecas` ao `select` já existente de `pedidos`; um único estado `drill`; um único `<IndicadorDrillDialog>` no fim do JSX; envolver os valores exibidos com `<ValorDrill>`.

Não tocados: `indicadores-olist.ts`, `indicadores-pdf.ts`, demais libs (`cop.ts`, `map.ts`, `pedidos.ts`, `dias-uteis.ts`, `olist-vendas.ts`, `cop-saldos.ts`), componentes de COP/MAP/outras abas do PCP, `src/components/ui/*`, `supabase/migrations/`.

## Contrato

```ts
type DrillTipo = "texto" | "numero" | "moeda" | "data" | "perc" | "dias";
interface DrillColuna { chave: string; label: string; tipo: DrillTipo; align?: "left"|"right"|"center"; somar?: boolean }
interface DrillPayload {
  titulo: string; subtitulo?: string; nota?: string;
  colunas: DrillColuna[]; linhas: Record<string, string|number|null>[];
  indicadorLabel: string; indicadorValor: number | null; totalConferencia: number | null;
}
```

Rodapé: `Soma das linhas: X · Indicador: Y`, com aviso amarelo discreto `⚠ conferência divergente` quando divergir (tolerância 0,01 em dinheiro, 0,05 em médias de dias úteis).

Funções construtoras: `drillPedidos`, `drillItensPorChave`, `drillGradeCelula`, `drillMensal`, `drillSituacao`, `drillCliente`, `drillVendedor`, `drillUf`, `drillFrete`, `drillVendidoProduzido`, `drillPcpPedidos`, `drillPcpPrazo`, `drillPcpEtapa`, `drillPcpEntregas`, `drillPcpAtraso`, `drillRefacoes`, `drillCorrecoes`, `drillSaude`.

Todas recebem as fontes já disponíveis no componente (`atuais`, `pcpPeriodo`, `pcpPorPedido`, `feriados`, `intervalo`, mapa de nomes de `useProfilesMap`) e reutilizam `diasUteisEntre` e `perdaPecasPcp` — nenhuma regra de negócio reimplementada.

## Ordem de execução (tudo nesta rodada)

**Fase A — infra + Bloco 8 (só PCP):** os três arquivos novos, colunas extras no select, e drill em: Pedidos no período, Prazo médio, Entregas no prazo, Atraso médio, Gargalo, Tempo médio por etapa (Arte / Estamparia / Acabamento / Expedição), Refações por área (Episódios, Peças a refazer, Peças perdidas com detalhe modelo·cor·tamanho·qtd), Pedidos atrasados, Pedidos em risco, Correções de etapa por aba.

Regras fixadas nesta fase: `perda_adesivos` e `qtd_falta_adesivos` em colunas próprias, nunca somados com peças (declarado na `nota`); peças perdidas via `perdaPecasPcp`; saída sempre por `saida_juff`; casamento Olist↔PCP só por `pedido_olist` (`orcamento` é coluna informativa); dias sempre em dias úteis com feriados; área ausente vira `—`. Subtítulo do bloco lembra que os filtros de empresa/vendedor/modelo/cor/tamanho/situação não valem aqui.

**Fase B — blocos de venda (Olist):** Bloco 1 Resumo (faturamento, pedidos, peças, ticket médio, preço médio/peça), Bloco 12 Rankings (modelo, cor, tamanho, peça), Bloco 2 (mensal incl. células JOKE/JUFF, e situação), Bloco 3 (composição por receita/volume, curva ABC, grades tamanho e cor incl. totais), Bloco 4 Clientes (Novos, Recorrentes e linhas), Bloco 5 Vendedores.

**Fase C — restantes:** Bloco 10 Frete, Bloco 6 UF, Bloco 7 Vendido × Produzido, Bloco 9 Saúde do cadastro, badge "Somente PCP".

## Verificação

Conferir que Acabamento abre os episódios do período e que a soma da coluna "Peças a refazer" bate com o número clicado; que zeros não ficam clicáveis; que Exportar PDF continua idêntico; typecheck limpo.
