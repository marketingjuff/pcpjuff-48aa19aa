# PLAN — três linhas por item e “em falta”

## Objetivo
Na tabela principal de **O que produzir**, mostrar por modelo/cor, nesta ordem:
1. **Pronto em estoque** por tamanho.
2. **Em produção** por tamanho.
3. **Sugestão de corte** por tamanho, com os números e destaques atuais.

Alteração apenas de apresentação: nenhuma fórmula, sugestão, total ou regra de planejamento muda. Implementação somente após aprovação explícita.

## Arquivo por arquivo

### `src/lib/plan.ts`
- Acrescentar `prontoFisico: Map<string, number>` à interface `SaldoRealPlan`, ao retorno vazio durante carregamento e ao retorno final de `usePlanSaldoReal`.
- No laço existente de montagem do saldo, guardar no novo mapa o mesmo `multiEmpresa` já calculado: `Math.max(0, joke + juff)`. Manter literalmente a fórmula atual de `saldoReal` e os mapas existentes.
- Acrescentar `prontoPorTam` e `producaoPorTam` à interface `LinhaNecessidade`.
- Acrescentar o parâmetro opcional `prontoFisico` a `montarNecessidade` e preencher os dois campos por tamanho, usando esse mapa e o `emProducao` já recebido; chave ausente resulta em zero.
- Não usar os campos novos em cálculos, seleção de grupos, ordenação, totais ou sugestões. Preservar todos os valores dos campos antigos.

### `src/components/plan/NecessidadeTab.tsx`
- Em `usePlanLinhas`, passar `saldo.data.prontoFisico` para `montarNecessidade`, mantendo as fontes e opções atuais.
- Acrescentar uma coluna de identificação logo após Cor e apresentar três linhas por grupo, na ordem solicitada.
- Mostrar Modelo, Cor, Total da sugestão, Já vendido e Situação somente uma vez por grupo, com células abrangendo as três linhas (`rowSpan`) e conteúdo alinhado ao topo.
- Alternar o fundo por grupo, não por linha; separar grupos somente pela borda inferior da terceira linha.
- Usar texto menor, normal e discreto nas duas primeiras linhas. Preservar na terceira os números de `aProduzirPorTam`, o destaque forte, o fundo de peça em falta e o zero apagado.
- Ajustar a abrangência das células de carregamento e tabela vazia ao novo número de colunas, sem alterar seus estados.
- Trocar a marcação `{firme} firme` por `{firme} em falta`, somente na sugestão de corte.
- Trocar também o título visível **Firme** da explicação por **Em falta**, preservando o significado; nenhum texto visível desta tela manterá “firme”. Variáveis internas permanecem como estão.
- Substituir a explicação final exatamente por:

  > O número da linha Sugestão de corte é o que falta cortar, somando o que já foi vendido e está em falta com o previsto para o horizonte. Peça pronta e peça em produção já estão descontadas, não precisa descontar de novo.

- Preservar os quatro indicadores superiores, a tabela de conferência e o formato atual da seção Cores fora de linha.

## Limites e interpretação técnica
- A especificação menciona “dois parâmetros novos e opcionais”, mas nomeia apenas `prontoFisico`; `emProducao` já existe e é obrigatório. Adicionar somente `prontoFisico` opcional, reutilizando `emProducao`, sem alterar contratos desnecessariamente. Sem mapa de pronto ou entradas para um tamanho, os valores correspondentes serão zero.
- Nenhuma nova consulta, escrita no banco ou migração.
- Não modificar `cop-saldos.ts`, `plan-cores.ts`, `pedidos.ts`, `TinturariaTab.tsx`, `ParametrosTab.tsx` nem outros arquivos de implementação. Este documento é apenas o plano obrigatório.
- Não descontar produção novamente. `aProduzirPorTam` e todos os campos antigos conservarão formato e valores; a Tinturaria continuará consumindo os mesmos dados de cálculo.
- Manter cores fora de linha, apelidos e exclusão de azul celeste exatamente como estão.

## Verificação antes de concluir
- Comparar a saída anterior e posterior de `montarNecessidade`, removendo apenas os dois campos novos na comparação, com horizontes de 3, 5 e 6 meses e casos de saldo positivo, negativo, zero e cor fora de linha.
- Conferir que pronto físico recebe o mesmo valor de `multiEmpresa`, inclusive seu piso zero, e que os novos campos por tamanho apenas espelham seus mapas.
- Comparar as sugestões de Tinturaria e os valores usados pelos quatro indicadores antes/depois, sem alterar suas fórmulas ou arquivos.
- Usar verificações temporárias fora do repositório, sem criar arquivos de teste ou dependências fora da allowlist.
- Verificar na tela o agrupamento, ordem das linhas, informação única por grupo, marcação “em falta” apenas na sugestão e preservação da seção Cores fora de linha.
- Conferir que somente os dois arquivos autorizados foram alterados e que não houve migração nem alteração de dados.
- Apresentar o resultado disponível da checagem automática de tipos e compilação. **Limitação do ambiente:** verificações manuais de tipos e compilação estão proibidas; não executar `tsgo --noEmit` manualmente nem afirmar que esse comando foi executado. Se não houver resultado explícito da checagem de tipos automática, informar essa pendência antes de dar por concluído.