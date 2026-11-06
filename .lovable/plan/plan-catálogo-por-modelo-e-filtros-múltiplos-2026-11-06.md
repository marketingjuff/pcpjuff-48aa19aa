# PLAN — catálogo por modelo e filtros múltiplos

## Resultado
O PLAN passa a montar sua grade pelo catálogo real de cada modelo, e não pela existência de vendas. O Estoque mínimo separa cores em linha das cores Outlet e das que o modelo não tem. As três abas de dados recebem filtros múltiplos de modelo e cor. Parâmetros recebe o editor do catálogo.

**Nenhum código será alterado antes da aprovação explícita deste plano.**

## Regras confirmadas e interpretações
- Cada modelo/cor tem um único estado: **Normal**, **Outlet** ou **Não tem**. As duas etiquetas não aparecem juntas.
- Outlet e cores ausentes têm produção e tingimento sugeridos iguais a zero. Conforme confirmado, isso pode reduzir os totais atuais. Acrescentar combinações realmente vazias não altera os totais.
- Conforme a versão 2, a lista global `plan_cores_fora_de_linha` continua zerando sugestões, mas não oculta mais linhas do Estoque mínimo. Nenhuma cor oficial é omitida. Cada cor no bloco fora de linha recebe uma única etiqueta, nesta precedência: **Fora de linha geral**, **Outlet**, **Não tem a cor**.
- Sob demanda das cores fora de linha é calculado em memória: abrir ou expandir a tela não grava mínimos. Suas sugestões são zero.
- “Tirar de fora de linha” promove somente a cor daquele modelo e desliga Sob demanda dos seus tamanhos. Quando houver marcações já gravadas, limpar somente essas marcações existentes, preservando números e dados de adoção; não criar registros de mínimo para tamanhos ainda não salvos. As demais marcações individuais continuam independentes do catálogo.
- Operadores podem filtrar, expandir e visualizar. Apenas ações de alteração ficam restritas a admin/gestor pela regra existente `podeEditarPlan`.
- Camiseta + Baby Look + amarelo são **dois pares modelo/cor**, com os respectivos tamanhos; não quatro pares.
- O padrão literal tem 16 modelos, 26 cores e **1.924 linhas por tamanho**, sem omitir cores globalmente bloqueadas. Não adicionar “Não Identificado” ao padrão.

## Alterações arquivo por arquivo

### 1. `src/lib/plan-catalogo.ts` — novo
Copiar exatamente a constante `CATALOGO_PADRAO` fornecida, sem corrigir nomes, reordenar modelos ou modificar listas. Manter as funções auxiliares no arquivo de lógica existente para preservar o literal.

### 2. `src/lib/plan.ts`
- Definir tipos do catálogo, validação e funções puras para classificação, promoção, restauração e alterações por cor em todos os modelos.
- Acrescentar `usePlanCatalogoModelos`: ler e salvar `map_config` na chave `plan_catalogo_modelos`, seguindo o padrão de `usePlanCoresForaDeLinha`. Compartilhar a consulta entre as abas e atualizar consumidores após salvar.
- Validar estrutura e descartar modelos, tamanhos e cores não oficiais; remover duplicatas sem reordenar. Configuração ausente ou estruturalmente inválida usa uma cópia do padrão. Em configuração parcial válida, preencher modelos omitidos com o padrão; lista de tamanhos vazia é válida e gera zero linhas. Sobreposição entre Normal e Outlet torna o conteúdo inválido, evitando classificação ambígua.
- Acrescentar parâmetro `catalogo` aos montadores, sem mudar nomes ou tipos dos parâmetros atuais. Os montadores não leem o banco.
- `montarEstoqueMinimo`: gerar todas as cores oficiais × tamanhos fabricados por modelo. Remover o descarte de cores da lista global e classificá-las como Fora de linha geral, com precedência sobre Outlet/ausente. Preservar mínimos existentes, zerar sugestões e silenciar defasados/Sob demanda dessas linhas sem gravação automática.
- `montarNecessidade`: gerar todos os pares do catálogo, calcular apenas tamanhos fabricados e remover o descarte de combinações sem consumo/firme. Preservar vendas, estoque e produção como informativos; zerar sugestões de Outlet/ausentes e manter o bloqueio global.
- Manter `itensSobDemandaDaCor` e gravações numéricas preservando as marcações do destino. Implementar a limpeza direcionada das marcações existentes na promoção, sem criar mínimo zero; apresentar erro se uma etapa da gravação falhar, sem anunciar sucesso parcial.
- Não alterar o comportamento de `usePlanCoresForaDeLinha`, pausas, saldos compartilhados ou outros módulos.

### 3. `src/components/plan/FiltroModeloCor.tsx` — novo
- Dois seletores múltiplos com `Popover`, `Checkbox`, nomes de modelos e cores mostradas por `CorChip` preenchido.
- Contadores de seleção e “Limpar filtro”. Nada selecionado significa tudo; modelo e cor se combinam por interseção.
- Disponibilizar estado reutilizável com persistência independente por aba em `localStorage`, validando valores e tolerando dados inválidos. Ler após carregar a tela, sem modificar as chaves dos horizontes.

### 4. `src/components/plan/EstoqueMinimoTab.tsx`
- Consumir o catálogo e calcular linhas e grupos com `useMemo`.
- Manter modelos recolhidos inicialmente. Dentro de cada modelo, mostrar normais primeiro e o bloco recolhido “Ver cores fora de linha (N)” abaixo, contando cores, não tamanhos.
- Mostrar uma única etiqueta — Fora de linha geral, Outlet ou Não tem a cor — conforme a precedência definida, e Sob demanda ligado nas linhas do bloco.
- Adicionar “Tirar de fora de linha” por cor para admin/gestor, com bloqueio durante gravação e apresentação de erros. Promover todos os tamanhos do modelo sem afetar outro modelo. Para cor na lista global, não mostrar o botão; mostrar “Esta cor está fora de linha para a Juff inteira, mude em Parâmetros”.
- Adicionar filtros múltiplos junto da busca e de “Mostrar só os defasados”; preservar as três condições combinadas.
- Preservar Copiar/Colar por cor, padrão copiado, diálogo “Colar em...”, substituição de mínimos e ações Sob demanda existentes nas cores elegíveis.
- Bloquear colagem fora de linha tanto na escolha dos destinos quanto em `itensDaColagem`; revalidar seleções após alterações do catálogo.
- Garantir que aceitar sugestões em lote não inclua cores fora de linha/Sob demanda, nem grave mínimos vazios involuntariamente pela expansão da grade.
- Preservar Tab/Shift+Tab entre campos Adotado e gravação ao sair/Enter.

### 5. `src/components/plan/NecessidadeTab.tsx`
- Carregar catálogo em `usePlanLinhas`, incluindo carregamento, erros e dependências do cálculo compartilhado com Tinturaria.
- Manter linhas com sugestão zero visíveis. Para tamanho não fabricado, mostrar “—”, sem valor ou sugestão.
- Adicionar filtros por modelo/cor a todas as seções: ativas, pausadas e fora de linha.
- Preservar pausas, firme, piso de mínimo e horizontes separados. Aplicar o filtro de modelo/cor também à base dos quatro cartões e totais: Camiseta + Baby Look + amarelo soma somente esses dois pares; sem filtro soma tudo. A nova classificação pode reduzir as sugestões conforme confirmado.

### 6. `src/components/plan/TinturariaTab.tsx`
- Adicionar filtros independentes e aplicá-los às linhas antes de `montarTinturaria` para recalcular peças e kg do recorte.
- Manter o horizonte de suprimento e a lógica atual de lote/cru.
- Estoque tingido e material na tinturaria continuam recursos compartilhados por cor, sem inventar rateio por modelo. Cartões de estoque e cru permanecem globais; o tecido necessário acompanha o recorte calculado.

### 7. `src/components/plan/ParametrosTab.tsx`
- Inserir “Cores e tamanhos por modelo” imediatamente abaixo de “Cores fora de linha”.
- Seleção de um modelo, sete controles liga/desliga de tamanho e 26 cores com segmentos Normal/Outlet/Não tem.
- Rascunho do catálogo inteiro, botão Salvar e “Restaurar padrão” somente do modelo selecionado. Restaurar altera o rascunho; Salvar confirma a persistência.
- Por cor, oferecer marcar Outlet ou voltar a Normal em todos os modelos. Confirmar por `AlertDialog`, contando somente modelos que efetivamente mudam; nunca acrescentar a cor em modelos que não a têm.
- Admin/gestor editam. Demais não recebem ações de escrita, respeitando também o acesso existente à aba. Falhas preservam o rascunho para nova tentativa.
- Ao salvar, refletir as alterações nas outras abas abertas sem recarregar.

### 8. `src/lib/plan-estoque-minimo.test.ts`
Preservar os 12 testes existentes e adaptar suas seleções de linha à grade completa. Acrescentar testes concretos para:
- Camiseta: 18 normais, 8 Outlet e sete tamanhos.
- Cross: 12 normais, fúcsia Outlet, amarelo ausente e apenas P/M/G/GG.
- Breeze: 26 ausentes e nenhuma cor em linha.
- Cor na lista global permanece na grade de todos os modelos com etiqueta Fora de linha geral, sugestão zero, Sob demanda ligado e precedência sobre o estado do catálogo; promoção não desfaz esse bloqueio.
- Tamanhos inexistentes nunca geram linha, mesmo presentes no histórico/mínimos.
- Sob demanda implícito sem registro e sem alterar os números adotados.
- Promoção isolada por modelo/cor e preservação dos mínimos ao limpar marcações existentes.
- Colagem recusada fora de linha; demais destinos mantêm sua marcação.
- Validação, fallback, restauração e ações coletivas que não criam cores ausentes.
- Necessidade com linhas vazias, sugestão zero fora de linha, totais invariantes ao acrescentar dados realmente zerados e redução por classificação.
- Interseção de filtros, quatro cartões de produção somando somente os pares selecionados e recálculo da Tinturaria com apenas o modelo selecionado.

## Limites e autorização existente
Não criar migração, executar SQL, alterar tabela/coluna/policy ou modificar arquivos protegidos. As alterações de aplicação ficam restritas aos oito arquivos acima.

**Risco identificado:** as permissões versionadas de `map_config` contêm liberações específicas para a chave global antiga, não necessariamente para a nova chave. A edição do catálogo pelo gestor e a leitura pelo operador dependem das permissões já existentes. Verificar pelo acesso real, sem contornar segurança ou alterar policies. Se o acesso for recusado, informar o impedimento e aguardar autorização separada; não considerar esses critérios concluídos.

## Verificação e entrega após aprovação
1. Executar os testes do arquivo autorizado e conferir a checagem automática de tipos e os registros de compilação; não executar compilação/typecheck manual, conforme o ambiente.
2. Conferir na tela com sessão válida: grade de Camiseta/Cross/Breeze, cor global descendo sem sumir e sem botão de promoção, promoção e persistência após recarregar, editor atualizando outra aba, filtros independentes, quatro cartões refletindo o recorte e recálculo de kg.
3. Verificar ações de edição como gestor e visualização sem ações de escrita como operador, quando essas sessões estiverem disponíveis; declarar qualquer caso não verificado.
4. Conferir campos Adotado, Sob demanda e colagem, além de telas estreita e larga.
5. Mostrar resultados dos testes, checagem automática e diff restrito aos oito arquivos antes de declarar concluído. Não criar arquivo adicional de diff no projeto; apresentar o diff na entrega.