# KPI Juff Store — segunda faixa sem vouchers

## Escopo
- Manter integralmente a faixa atual, o bloco Frete, Juff Custom, composição, rankings, tabelas, gráficos e PDFs.
- Acrescentar somente no KPI Juff Store a faixa **Venda real, sem peças de voucher**, entre os indicadores atuais e Frete.
- Configurações > KPI acessível somente a administradores, conforme sua confirmação.
- Nenhum código será alterado antes da aprovação deste plano.

## Plano arquivo por arquivo

### 1. `src/lib/indicadores-store.ts`
Acrescentar `LIMITE_VOUCHER_PADRAO = 20`, `ResumoSemVoucher` e a função pura `resumoSemVoucher`, sem mudar funções existentes.
- Usar apenas `p.itensSel`. Voucher: item não serviço, quantidade positiva e `subtotal / qtd < limite`; preço igual ao limite permanece real.
- Separar bruto real, voucher e serviço. Ratear desconto do pedido pelo subtotal completo, sem subtrair desconto de item novamente.
- Pedido com item real conta uma vez: soma peças reais, receita líquida real e serviço, e todo seu frete. Pedido sem item real não entra nesses indicadores nem no frete.
- Acumular peças e receita líquida de voucher, contando em `voucherPedidos` somente pedidos inteiramente excluídos.
- Ticket = faturamento / pedidos; preço médio = receita líquida dos produtos reais / peças. Divisão sem denominador retorna zero.

### 2. `src/components/kpi/KpiConfigPanel.tsx` — novo
- Criar painel com card Juff Store, campo de texto para limite em reais e Salvar, no padrão visual existente.
- Leitura via `useQuery` e gravação via `useMutation`/`upsert` na chave `kpi_store_limite_voucher` de `map_config`; invalidar a mesma chave de consulta usada pela tela de indicadores e emitir avisos de sucesso/erro.
- Aceitar valor não negativo com até duas casas decimais, incluindo vírgula brasileira, sem spinner. Configuração ausente ou inválida usa R$ 20,00.
- Conferir `useIsAdmin` antes de permitir salvar; painel somente leitura caso seja renderizado para não admin, embora o menu permaneça admin-only.

### 3. `src/routes/_authenticated/configuracoes.tsx`
- Importar o painel; acrescentar `kpi` a `SecaoSlug` e `SLUGS`.
- Adicionar KPI em Cadastros logo após SUP, somente para admin, sem propriedade `modulo`.
- Renderizar o painel na seção KPI. Não mudar as outras seções.

### 4. `src/components/kpi/IndicadoresTab.tsx`
- Consultar a chave do limite somente no escopo Store; usar padrão R$ 20,00 para valor ausente ou inválido.
- Calcular resumos atual e anterior em `useMemo`, utilizando os mesmos pedidos já filtrados, sem alterar os filtros.
- Inserir faixa com os mesmos seis cards e comparações: Faturamento, Faturamento + frete, Pedidos, Peças vendidas, Ticket médio e Preço médio/peça. Sem clique de detalhamento nos novos cards.
- Usar fundo/borda semânticos para distinguir a faixa e os textos solicitados, com limite vigente e totais excluídos no rodapé.
- Respeitar o olho e a permissão de faturamento: esconder cards e valores em reais também na nova faixa e seus textos quando necessário; conservar as contagens.
- Não tocar no bloco Frete nem na faixa atual ou exportações.

## Conferência e limites dos critérios
- Conferir pedido misto, pedido só voucher, valor exatamente R$ 20,00, serviços, desconto proporcional, período anterior, configuração e visibilidade de valores.
- A fórmula solicitada exclui também serviços de pedidos sem peças reais. Nesses casos, **receita real + receita somente das peças voucher não recompõe a receita total**. Pedidos só de serviços também impedem igualdade completa com limite zero. Seguirei a fórmula explícita, sem redistribuir serviços nem alterar o faturamento de voucher; essas exceções serão sinalizadas na verificação.
- Validar cálculos com casos concretos executados temporariamente fora do projeto, sem criar um quinto arquivo na allowlist. Conferir a tela com sessão autenticada, sem alterar pedidos ou vendas.
- Conferir compilação automática e executar verificação de tipos se disponível, mostrando o resultado sem afirmar validação não executada.

## Restrições técnicas
Somente os quatro arquivos de implementação acima. Sem migração, SQL, alteração de permissões do banco, dependências ou dados de vendas. A única gravação prevista é a configuração do limite quando um admin clicar em Salvar. Documentação do plano e memória não fazem parte da implementação.