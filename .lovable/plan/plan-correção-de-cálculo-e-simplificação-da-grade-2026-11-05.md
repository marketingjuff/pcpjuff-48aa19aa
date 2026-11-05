# PLAN — correção de cálculo e simplificação da grade

Allowlist estrita: `src/lib/plan.ts`, `src/components/plan/NecessidadeTab.tsx`, `src/components/plan/TinturariaTab.tsx`. Nenhuma migração, nenhuma alteração de banco, nenhum outro arquivo. `cop-saldos.ts` e `SaldoRealTab.tsx` servem só de referência de leitura.

## 1. `src/lib/plan.ts`

**a) `normalizarCor(bruto: string): string | null` (função pura nova)**
- Normaliza: minúsculas, sem acento (NFD + remoção de diacríticos), espaços colapsados, bordas aparadas.
- Passo 1: casamento exato com alguma cor de `REFACAO_CORES` normalizada da mesma forma → devolve o nome canônico.
- Passo 2: casamento por conteúdo — a cor canônica normalizada aparece como palavra inteira no texto, ou o texto como palavra inteira nela. Exatamente uma candidata → devolve ela; zero ou mais de uma → `null`.
- Sem lista de sinônimos fixa, sem adivinhação.
- Garante os casos de aceite: `"verde menta"`, `"VERDE MENTA"`, `"Menta"` → `menta`.

**b) `usePlanSaldoReal()` (hook novo, substitui `usePlanDisponivel` como fonte de estoque)**
- Reproduz a montagem de `SaldoRealTab.tsx`:
  - `cops` e `pedidos` com as mesmas query keys (`["cops"]`, `["pedidos-cop-saldos"]`), agora **paginados com o helper `paginar`** (corrige o corte de 1000 linhas — ajuste menor do prompt).
  - `disponivel = calcDisponivel(calcEmProducao(cops), calcFaltantes(pedidos), calcRecebido(cops), calcPerdas(cops))` — sem tocar em `cop-saldos.ts`.
  - Estoque Olist: lê `estoque_olist_snapshots` (último snapshot por empresa) e `estoque_olist_itens` paginado, com as mesmas query keys `["estoque-olist", ...]` para dividir cache com o COP. Traduz `produto_olist` → `modelo_cop` via `olist_produto_map`.
  - `multiEmpresa = max(0, JOKE + JUFF)` por chave; `saldoReal = multiEmpresa + disponivel`.
- **Normalização de cor aplicada na entrada**: a cor de cada item Olist passa por `normalizarCor`; se `null`, o item vai para a lista de não reconhecidas (texto original + quantidade) e não entra nos totais. A chave de agregação usa o nome canônico.
- Devolve: `{ saldoReal: Map<pkKey, number>, emProducao: Map<pkKey, number>, naoMapeados: Map<string, number>, coresNaoReconhecidas: Map<string, number> }`.
- `usePlanDisponivel` é absorvido por este hook (removido como export).

**c) `usePlanVendaHistorica()` — normalização de cor**
- A cor de cada item vendido passa por `normalizarCor` antes de montar a chave; `null` vai para `coresNaoReconhecidas` (texto original + peças), fora dos totais. Resto inalterado.

**d) `usePlanEstoqueTingido()` e `usePlanNaTinturaria()` — normalização de cor**
- A cor (da programação ou da peça) passa por `normalizarCor`; `null` acumula em lista de não reconhecidas devolvida pelo hook. Agregação por nome canônico — é o que faz o estoque tingido descontar por cor de verdade (defeito 4).

**e) `montarNecessidade` — nova fórmula (defeitos 1 e 2)**
- Assinatura passa a receber `saldoReal` no lugar de `disponivel` (mantém `emProducao` só para a coluna informativa).
- Por tamanho:
  - `estoqueLivre = max(0, saldoReal)`
  - `firme = max(0, -saldoReal)`
  - `previstoBruto = mediaMensal × horizonteMeses + mediaMensal × semanasSeguranca / 4.33`
  - `previstoLiquido = max(0, previstoBruto − estoqueLivre)`
  - `aProduzir = firme + previstoLiquido`
- `emProducao` **não entra em nenhuma subtração** — só preenche a coluna informativa da tabela de conferência.
- `LinhaNecessidade` simplificada: sai o par `vendido`/`previsto` por tamanho; entra `aProduzirPorTam: Record<string, number>` e `firmePorTam: Record<string, number>`. Mantém `jaVendido` (soma do firme), `emEstoque` (soma do estoqueLivre), `emProducao`, `aProduzir`, `vendaPrevistaMensal`, `diasRuptura` (0 se há firme; senão `diasAteRuptura(estoqueLivre total, consumo)`).
- Combos críticos: saldo real ≤ 0 ou ruptura dentro do lead time — deixa de marcar tudo como crítico.

**f) `montarTinturaria` — ajuste de coerência**
- Passa a somar `aProduzirPorTam` (firme + previsto líquido) em vez de `vendido + previsto`.
- O desconto por cor (`kgEstoque` + `kgTinturaria` antes de arredondar pelo lote) já existe; com as cores normalizadas ele passa a casar. Card "Tecido necessário" e soma de "A tingir" ficam coerentes.

## 2. `src/components/plan/NecessidadeTab.tsx`

- `usePlanLinhas` passa a usar `usePlanSaldoReal` e expõe `coresNaoReconhecidas` (venda + saldo real) e `naoMapeados`.
- **Aviso visível de cores não reconhecidas** acima da grade: texto original + quantidade, no mesmo estilo do aviso de produtos sem de-para. Fora dos totais.
- **Grade em uma linha só** (simplificação):
  - Remove as sublinhas Vendido/Previsto. Cada modelo+cor = uma `<tr>`.
  - Célula de tamanho mostra o total a produzir; quando há firme, fundo levemente destacado (`bg-amber-50` ou similar) com o valor firme em tipo menor abaixo do total. Célula zerada continua apagada.
  - Duas colunas ao final: **Total** e **Já vendido** (soma do firme da linha).
  - Mantém cabeçalho congelado, rolagem horizontal, chip de cor e tabela de conferência recolhida.
- Tabela de conferência: coluna **Em produção** ganha nota curta ("informativo — já está dentro do saldo, não desconta de novo").
- Textos de ajuda no rodapé atualizados para a nova fórmula (saldo real, não mais "Disponível").
- Card "Peça pronta em estoque" passa a somar `estoqueLivre` do saldo real — coerente com a aba Saldo Real do COP.

## 3. `src/components/plan/TinturariaTab.tsx`

- Sem mudança de estrutura: consome as linhas já corrigidas e os mapas de estoque/tinturaria já normalizados por cor. Ajuste apenas se a assinatura de `montarTinturaria` mudar.
- Cor cujo tingido em estoque cobre a necessidade não gera sugestão (consequência direta do casamento por cor).

## Verificação

- Typecheck (`tsgo`) ao final, resultado mostrado antes de concluir.
- **Sem abrir o navegador**, conforme instruído.
- Conferência final: `git diff --stat` para provar que só os 3 arquivos da allowlist mudaram e nenhuma migração foi criada.
