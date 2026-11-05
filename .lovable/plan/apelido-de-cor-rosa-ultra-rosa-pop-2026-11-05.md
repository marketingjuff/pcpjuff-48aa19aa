# Apelido de cor: rosa ultra → rosa pop

## Objetivo e limites
Reconhecer “rosa ultra” como “rosa pop” nas três entradas de cor externas, usando uma única definição. A lista oficial de cores continuará intacta: nenhum nome, hex ou posição será alterado, e o apelido não será oferecido em seletores, filtros ou configurações.

Nenhuma migração, alteração de dados ou reimportação. Os únicos arquivos de implementação alterados serão os quatro da allowlist. Os arquivos protegidos permanecerão intocados. Este documento é apenas o plano solicitado.

## Alterações arquivo por arquivo

### 1. `src/lib/pedidos.ts`
- Acrescentar `CORES_APELIDOS: Record<string, string>` perto de `REFACAO_CORES`, contendo somente `"rosa ultra": "rosa pop"`.
- Incluir o comentário solicitado, explicando que apelidos externos não são cores oficiais e nunca devem aparecer nas opções do sistema.
- Não alterar `REFACAO_CORES` nem outros valores existentes.

### 2. `src/lib/plan.ts`
- Importar `CORES_APELIDOS` junto de `REFACAO_CORES`.
- Em `normalizarCor`, consultar o apelido após a normalização e a rejeição de texto vazio, antes da busca exata.
- Preservar integralmente a busca por palavra inteira, a exigência de candidata única e o retorno `null` para cores não reconhecidas.
- Como vendas e estoque já usam essa função na leitura, as peças de “rosa ultra” passarão a ser agregadas em “rosa pop” sem reimportação.

### 3. `src/lib/estoque-olist.ts`
- Importar `CORES_APELIDOS`.
- Calcular `n = semAcento(cor)` e retornar `COR_SET.get(n) ?? CORES_APELIDOS[n] ?? cor.trim()`.
- Preservar a prioridade das cores oficiais e o retorno original para nomes desconhecidos. Futuras importações reconhecerão o apelido antes de gravar a cor.

### 4. `src/lib/indicadores-store.ts`
- Importar `CORES_APELIDOS` junto dos imports existentes de `pedidos`.
- Logo após construir `COR_POR_NORM`, acrescentar o laço solicitado para incluir cada apelido apontando à cor canônica.
- Não alterar classificação de produtos além desse reconhecimento de cor; nenhuma alteração nos cálculos financeiros, descontos ou na faixa de venda real sem voucher.

## Verificação
- Conferir que os três tratamentos reconhecem “rosa ultra” e variações de caixa/acento como “rosa pop”, e que “rosa pop” continua funcionando diretamente.
- Conferir que cores oficiais e entradas desconhecidas preservam seus comportamentos anteriores; no PLAN, texto vazio e correspondência ambígua continuam retornando `null`.
- Conferir agregação de uma amostra de 201 peças com apelido junto a peças já canônicas, sem perda ou duplicação. Essa amostra valida a regra; não será apresentada como confirmação da quantidade atual no banco.
- Conferir os parsers de estoque e Store com descrições de produto contendo o apelido.
- Usar verificações temporárias fora do repositório, sem criar arquivo de teste fora da allowlist; conferir o diff para garantir que a lista oficial e os arquivos protegidos não mudaram.
- Não abrir o navegador nem executar escrita no banco. A contagem efetiva na tela ficará sem verificação visual nesta execução.
- Consultar a compilação automática e informar seu resultado. O ambiente proíbe rodar typecheck manualmente; portanto, não executar nem afirmar execução de `tsgo --noEmit`, apesar da solicitação do documento. Informar explicitamente essa limitação no relatório final.

## Resultado esperado
O aviso de cores não reconhecidas deixa de incluir “rosa ultra” nas entradas alcançadas pela normalização, e suas peças passam a compor “rosa pop”. Quando a Olist enviar o nome correto, o mesmo fluxo continuará funcionando sem desfazer o apelido.

## Aprovação
Aguardar aprovação explícita antes de alterar qualquer arquivo de implementação.