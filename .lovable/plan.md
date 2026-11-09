# PLAN v3 — salvamento mais rápido e marcação de cores zeradas

## Resultado esperado
- Salvar Adotado, marcar Sob demanda, colar e aceitar sugestões sem recarregar todo o PLAN nem manter os botões bloqueados enquanto as leituras terminam.
- Acrescentar **Marcar zerados sob demanda** no topo de Estoque mínimo, ao lado do selo de defasados, com confirmação e resumo por modelo/cor.
- **Salvar zero continua sem marcar Sob demanda automaticamente.** A nova ação só marca cores normais em que todos os tamanhos têm zero gravado; branco não conta como zero.

## Escopo
Implementação apenas nos três arquivos autorizados abaixo. Sem SQL, migração, alteração de permissões, cache global, cálculos compartilhados do COP, outras abas ou exports existentes. Os testes atuais serão preservados integralmente. Este plano não autoriza alterações de código: a implementação aguarda aprovação explícita.

## Arquivo por arquivo

### 1. `src/lib/plan.ts`
**Cache e leituras**
- Importar apenas `useMemo` e o tipo `QueryClient` como novos imports.
- Nomear as chaves de cores fora de linha, catálogo, fichas, configuração, pausas e mínimos com os sufixos atuais; criar a chave comum de mutations de mínimos.
- Aplicar as três políticas da especificação: histórico com 5 minutos e sem recarga ao voltar à janela; dados externos com 5 minutos; dados leves do PLAN com 1 minuto.
- Nas cinco consultas compartilhadas de Saldo Real, acrescentar somente a política, preservando chaves, consultas e `select("*")`.

**Salvamento**
- Substituir todas as invalidações do prefixo inteiro por invalidações específicas: cores → cores; catálogo → catálogo; promoção → catálogo e mínimos; configuração → configuração; ficha → fichas; adiar/retomar → pausas.
- Nas três mutations de mínimos, usar a mesma chave e os auxiliares de atualização otimista especificados: cancelar leitura de mínimos, guardar o mapa anterior, atualizar imediatamente e restaurar em caso de erro.
- Aplicar no cache os mesmos valores gravados; Sob demanda preserva mínimos, sugestão e autoria/data existentes. Manter `sob_demanda: i.sobDemanda ?? false` em `upsertMinimos`.
- Recarregar somente mínimos quando a última mutation em andamento terminar. O `onSettled` não retorna a promessa de recarga, liberando os controles após a gravação.
- Substituir a leitura individual por tamanho de Sob demanda por uma única consulta com os modelos, cores e tamanhos distintos, indexando o resultado por `pkKey`; manter uma única gravação em lote e as regras atuais de preservação.

**Referências estáveis**
- Memoizar configuração e seu retorno a partir dos dados da consulta.
- Reutilizar constantes vazias para cores fora de linha, pausas e Saldo Real durante carregamento.
- Memoizar o cálculo e retorno de Saldo Real, chamando os hooks antes de qualquer retorno e preservando o cálculo existente linha por linha.

**Seleção de zerados**
- Acrescentar `itensZeradosSobDemanda` após `itensSobDemandaDaCor`, conforme o algoritmo fornecido: agrupar por modelo/cor apenas linhas normais, exigir `adotado === 0` em todos os tamanhos e devolver somente os ainda não marcados.

### 2. `src/components/plan/EstoqueMinimoTab.tsx`
- Importar a função de zerados e `toast`.
- Calcular a seleção com a lista completa `linhas`, nunca com os blocos filtrados; memoizar contagens de modelos, cores e tamanhos e a lista agrupada.
- Adicionar o botão **Marcar zerados sob demanda**, `size="sm"`, `variant="outline"`, visível apenas para quem pode editar. Desabilitar durante carregamento, erro de catálogo, ausência de itens elegíveis ou gravação de mínimos. Incluir o título com a contagem ou a mensagem de ausência.
- Adicionar confirmação no padrão existente, com os textos exatos da especificação, lista rolável por modelo e cores em `CorChip`, preservando o nome do produto junto às cores.
- Confirmar com uma única chamada `salvarSobDemanda.mutateAsync(zerados)`. Exibir toast de sucesso com singular/plural correto; falhas usam a caixa existente via `setErro`.
- Não alterar os outros controles, filtros ou comportamentos visuais.

### 3. `src/lib/plan-estoque-minimo.test.ts`
- Somente acrescentar ao final o bloco fornecido, reutilizando os auxiliares existentes, sem modificar imports, testes ou fixtures atuais.
- Acrescentar os sete casos: cor totalmente zerada; tamanho positivo impede marcação; branco impede marcação; não reenviar tamanho marcado; cor inteira marcada não gera ação; excluir Outlet/global; incluir múltiplas cores completas e ignorar parciais.
- Manter o teste atual que comprova que Adotado zero continua normal e pode permanecer defasado.

## Validação e entrega
- Executar os dois arquivos de testes do PLAN com o mesmo comando usado anteriormente: `bun test src/lib/plan-estoque-minimo.test.ts src/lib/plan-permissoes.test.ts`; expectativa de 41 testes passando.
- Conferir a checagem automática de tipos e compilação, distinguindo os 15 erros antigos citados em `FaltaPecaPopup.tsx` de qualquer erro novo; não tocar nesse arquivo nem executar builds/typechecks manuais do projeto.
- Validar com sessão autorizada: salvar valores com Tab em cinco linhas, conferir após atualização da página, salvar zero sem marcação automática, observar atualização antes da resposta e reversão após falha simulada.
- Observar as requisições após salvar: nenhuma releitura de Olist/COP/MAP; somente usuário, gravação e recarga de mínimos. Verificar que os controles não esperam pela recarga.
- Conferir ações de configuração, ficha, catálogo e pausas com recarga restrita, além do retorno à janela dentro de 5 minutos.
- Validar confirmação e marcação de zerados mesmo com filtro/busca/defasados ativos, exclusões, preservação dos mínimos e uma única leitura prévia e gravação; restaurar os dados temporários usados na verificação.
- Conferir ausência de invalidação com `PLAN_KEY` puro e que o diff de aplicação contém somente os três arquivos autorizados.
- Entregar resultado das verificações e diff completo; indicar explicitamente qualquer verificação não realizada.

## Limite desta versão
A versão 3 elimina as recargas pesadas disparadas por salvamentos e limita a frequência das leituras. Não acrescenta propagação de `AbortSignal` às consultas paginadas, pois essa mudança não faz parte da implementação prescrita.