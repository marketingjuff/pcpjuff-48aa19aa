# PLAN — cores fora de linha

## Resultado
Admin poderá marcar cores fora de linha em Parâmetros. Elas continuarão no sistema, com vendas, estoque e produção reais visíveis numa tabela separada do PLAN, mas não terão sugestão de produção nem de tingimento.

As decisões do documento serão seguidas integralmente. A autorização adicional permite somente o ajuste mínimo de permissão necessário para proteger essa configuração no banco.

## 1. `src/lib/plan.ts`
- Adicionar `CHAVE_CORES_FORA_LINHA = "plan_cores_fora_de_linha"` e `usePlanCoresForaDeLinha`, com consulta sob `PLAN_KEY`.
- Ler apenas `value` dessa chave em `map_config`. Aceitar arrays, descartando itens que não sejam nomes canônicos de `REFACAO_CORES`; valor ausente, nulo ou malformado resulta em conjunto vazio. Erro da consulta não será tratado como confirmação de que nenhuma cor está marcada.
- Salvar por `upsert` somente nessa chave, com array validado, sem duplicatas, e `updated_at`; invalidar `PLAN_KEY` no sucesso e exibir avisos de sucesso/erro. Nenhuma gravação automática ao abrir a página.
- Acrescentar `foraDeLinha: boolean` a `LinhaNecessidade` e `coresForaDeLinha?: Set<string>` aos parâmetros de `montarNecessidade`.
- Manter todos os cálculos existentes; somente zerar `aProduzir` e todos os tamanhos de `aProduzirPorTam` para cores marcadas. Preservar venda prevista, já vendido, estoque, produção e ruptura.
- Preservar exatamente a regra `if (consumo === 0 && firmeTot === 0) continue;`.
- Registrar no comentário da regra que cores fora de linha podem ter peças já vendidas e não entregues, mas continuam com produção sugerida zero por decisão de negócio.
- Sem o parâmetro novo, preservar os valores calculados atuais, com `foraDeLinha: false`.
- Atualizar o comentário inicial para mencionar a única configuração JSON que o PLAN passa a salvar em `map_config`.

## 2. `src/components/plan/NecessidadeTab.tsx`
- Em `usePlanLinhas`, consultar as cores fora de linha e repassar o conjunto ao cálculo.
- Retornar `linhas` somente com cores ativas e `linhasForaDeLinha` com as marcadas. Incluir a nova consulta no carregamento e propagar falhas para não mostrar sugestões como se a marcação tivesse sido lida com sucesso.
- Manter `usePlanLinhas()` sem exigir argumentos e preservar as assinaturas de `CorChip` e `HorizonteSelect`.
- Os quatro cards continuarão com as fórmulas atuais, somando somente `linhas` ativas.
- Manter as tabelas existentes para cores ativas.
- Abaixo delas, quando houver linhas marcadas, exibir “Cores fora de linha”, o texto de apoio fornecido e uma tabela com a mesma estrutura, classes e colunas do resumo: Modelo, Cor, Venda prevista/mês, Já vendido, Em estoque, Em produção e A produzir.
- Usar o mesmo `CorChip` e adicionar o badge “Cor fora de linha”. Manter “Já vendido” visível e “A produzir” zero.
- A seção não aparecerá quando não houver linhas fora de linha.

## 3. `src/components/plan/ParametrosTab.tsx`
- Acrescentar a seção “Cores fora de linha” com o texto solicitado, seguindo o padrão visual da aba.
- Listar todas as cores de `REFACAO_CORES`, na ordem original, com chip e caixa de marcação; marcado significa fora de linha.
- Manter seleção local até clicar em Salvar, enviando o array completo de nomes canônicos marcados.
- Reutilizar `useIsAdmin`, o aviso de somente leitura e `Lock`. Não-admin visualiza as marcações mas não pode editá-las nem salvar.
- Bloquear edição/salvamento durante carregamento, erro de leitura ou gravação pendente; indicar sucesso/erro conforme o padrão existente.

## 4. Ajuste mínimo de permissão autorizado
As políticas atuais de `map_config` também permitem escrita por usuários com acesso ao MAP. O bloqueio da tela sozinho não garante admin-only.

- Aplicar uma única alteração de permissões, registrada pela ferramenta de migração, sem tabela nova, coluna nova ou alteração de dados.
- Acrescentar políticas restritivas de INSERT e UPDATE para que a chave `plan_cores_fora_de_linha` só possa ser gravada por admin. No UPDATE, conferir tanto a linha anterior quanto a nova, impedindo troca de chave como forma de contornar a regra.
- Proteger também a exclusão dessa chave contra não-admin, sem executar exclusão alguma.
- Acrescentar leitura limitada a essa chave para gestor e usuários com acesso ao PLAN, pois hoje usuários sem acesso ao MAP podem não conseguir lê-la.
- Preservar as políticas existentes e o comportamento de todas as demais chaves de `map_config`.
- A ferramenta registrará o arquivo de migração e poderá atualizar arquivos gerados automaticamente; esta é a exceção à allowlist autorizada para o ajuste de permissão. Nenhuma edição manual em arquivos gerados.

## Arquivos protegidos e limites
- Não alterar `TinturariaTab.tsx`: ela continuará usando `linhas` do hook compartilhado, que agora terá apenas cores ativas. Portanto, deixará de sugerir tingimento de cor marcada sem mudar seu arquivo.
- Não alterar `pedidos.ts`, `cop-saldos.ts`, parsers Olist, KPI, rotas ou outros módulos.
- Não retirar cores oficiais de nenhuma lista, filtro, chip ou configuração de PCP/COP/MAP/SUP/KPI.
- Não modificar `plan_config` nem gravar em qualquer outra chave de `map_config`.
- Não marcar nenhuma cor por conta própria; a seleção inicial dependerá exclusivamente da configuração existente, ou será vazia se ausente.

## Verificação
- Testar conjunto ausente/vazio, conteúdo inválido e descarte de nomes desconhecidos.
- Testar cor ativa contra os valores atuais; cor marcada com produção zero total e por tamanho, preservando os demais valores; saldo negativo com “Já vendido” preservado; manutenção da regra de omitir linha sem consumo nem demanda firme.
- Testar separação de linhas, somas dos quatro cards e ausência de cor marcada nas sugestões de tinturaria; desmarcação deve restaurar os resultados anteriores.
- Verificar no banco as políticas aplicadas e seus predicados, incluindo proteção contra troca de chave. Não gravar configurações reais para testar.
- Usar testes temporários fora do repositório e conferir a allowlist e os arquivos protegidos ao final. Não abrir o navegador; comportamento visual e fluxo autenticado de salvar não serão apresentados como verificados.
- Consultar a compilação automática e mostrar seu resultado. O ambiente proíbe typecheck manual; não executar nem afirmar execução de `tsgo --noEmit`. Informar essa limitação explicitamente no relatório final.

## Aprovação
Aguardar aprovação deste plano completo, incluindo a exceção de permissão autorizada, antes de implementar ou aplicar qualquer mudança no banco.