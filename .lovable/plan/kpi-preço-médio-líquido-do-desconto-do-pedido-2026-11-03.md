# KPI — preço médio líquido do desconto do pedido

## Escopo
Corrigir os indicadores nas abas Juff Custom e Juff Store, mantendo os descontos de item como já importados pela Olist. Nenhuma alteração no banco, nas dependências ou nos arquivos protegidos. A implementação só começa após aprovação explícita deste plano.

## Alterações por arquivo

### 1. `src/lib/indicadores-olist.ts`
- Em `resumo()`, substituir apenas a soma de `receitaProdutos` pelo cálculo solicitado: subtotal dos produtos selecionados, menos a parcela proporcional do desconto do pedido usando `p.subtotal` como base do pedido inteiro.
- Se `p.subtotal` for zero, a parcela do desconto será zero, conforme o código fornecido.
- Manter serviços fora do numerador e do denominador; não descontar novamente o desconto de item.
- Preservar `faturamento`, `pecas`, `ticket` e a assinatura da função.

### 2. `src/lib/indicadores-store.ts`
- Em `composicaoStore()`, calcular por item `descItem` e `liquidoItem` exatamente como solicitado.
- Acumular `liquidoItem` no faturamento de Lisas/Estampadas e também no de Kit Outlet.
- Preservar contagens, classificação e fórmulas derivadas de percentuais, ticket e preço médio; esses resultados passarão a usar a receita líquida acumulada.

### 3. `src/components/kpi/IndicadoresTab.tsx`
- Alterar somente a nota do detalhe do card Preço médio/peça para:

> Preço médio = receita de produtos já descontado o cupom do pedido, dividida pelas peças. A coluna abaixo mostra o subtotal bruto de cada item, antes do cupom, então o total da lista pode ficar acima do indicador.

- Não modificar o cálculo do PDF por faixas, a lista do detalhe ou qualquer outro trecho deste arquivo.

## Conferência
- Executar verificações isoladas, sem criar arquivos no projeto: pedido de uma peça com subtotal R$ 100 e desconto de pedido R$ 20 deve resultar em ticket e preço médio de R$ 80; sem desconto, deve permanecer R$ 100.
- Conferir rateio com serviços e seleção parcial: pedido com R$ 100 de produtos, R$ 50 de serviços e desconto de R$ 30 deve gerar receita líquida dos produtos de R$ 80, sem redistribuir o desconto inteiro apenas aos itens filtrados.
- Conferir Lisas R$ 100 e Estampadas R$ 200 com desconto de R$ 30: receitas líquidas R$ 90 e R$ 180, total R$ 270 e percentuais somando 100%; Kit Outlet deverá refletir a mesma parcela líquida dos itens que pertencem a ele.
- Conferir que o desconto de item não é subtraído novamente.
- Verificar o resultado automático de compilação e executar a conferência de tipos disponível, sem rodar manualmente build ou typecheck do projeto. Informar o resultado antes de concluir; se não estiver disponível, registrar a limitação, sem declarar aprovação dessa etapa.
- Revisar o diff para confirmar alterações somente nos três arquivos permitidos e nenhuma migração.

## Observação sobre o critério 1
O rateio solicitado corrige a diferença causada pelo cupom. A desigualdade universal “preço médio ≤ ticket quando a média de peças ≥ 1” não é garantida apenas por essas fórmulas em conjuntos com descontos desproporcionais entre pedidos ou valores negativos. A conferência usará casos com quantidades e receitas líquidas não negativas, incluindo o pedido de peça única com cupom que motivou a correção; não serão acrescentadas travas ou mudanças de fórmula fora do pedido.