# Estoque mínimo — colar o padrão por modelo e cor

Único arquivo alterado: `src/components/plan/EstoqueMinimoTab.tsx`. Sem migração, sem SQL, sem mexer em `plan.ts` ou outros arquivos protegidos.

## O que muda na tela
1. **Copiar colado no chip de cor**: faixa de cor passa a `flex items-center gap-2`; botão ghost compacto `h-6 px-1.5`, ícone `Copy` + "Copiar" (11px), `title`/`aria-label` "Copiar padrão desta cor", `stopPropagation`. Fica `secondary` quando aquela cor é a origem do padrão atual. Só admin/gestor vê.
2. **Sai "Colar padrão aqui"** do cabeçalho do modelo; "Aceitar todas deste modelo" fica sozinho, intacto.
3. **"Colar em..."** (default, sm) na faixa "Padrão copiado de ...", antes de Limpar. Único caminho de colagem; só admin/gestor.
4. **Diálogo** (`Dialog`, `sm:max-w-2xl`, `max-h-[80vh]`, lista com rolagem):
   - Título "Colar o padrão de {modelo} {cor}".
   - Tabelinha de 2 linhas com tamanhos/valores do padrão na ordem de `REFACAO_TAMANHOS`.
   - Switch "Substituir mínimos já definidos" (ligado por padrão) + frase fixa cinza sobre tamanhos ignorados/inalterados.
   - Busca própria do diálogo (modelo ou cor).
   - Lista a partir de `linhas` completas (sem `busca`/`soDefasados`): grupo por modelo fechado por padrão, checkbox com estado parcial (marca/desmarca só as cores visíveis pela busca), contagem de cores, seta; dentro, checkbox + `CorChip` + "{n} tamanhos mudam" ou "nada a mudar" (`opacity-60`, ainda marcável) + etiqueta "origem" na cor de origem.
   - Seleção guardada como conjunto `modelo|cor`, preservada ao buscar.
   - Rodapé: "{linhas} linhas, {cores} cores, {modelos} modelos" (contando só o que será gravado); Cancelar e Colar (desabilitado sem itens ou durante gravação).

## Regra do lote
Para cada modelo+cor marcado, linhas existentes em `linhas` cujo tamanho está no padrão, valor diferente do Adotado e — com a chave desligada — Adotado nulo. Item `{modelo, cor, tamanho, minimo: valorPadrão, sugerido: l.sugerido}` (sugerido do destino). Nunca cria combinação nova. Grava com `salvarLote.mutateAsync`; erro → `setErro("Não foi possível colar o padrão: {msg}")`; sucesso → fecha, limpa seleção, mantém o padrão copiado. A invalidação existente atualiza tabela e Situação.

## Limpeza
- `montarColagem` vira `itensDaColagem(linhas, valores, substituir)` (função pura, usada no resumo, na contagem por cor e na gravação).
- Remove `ColagemMinimo`, `prepararColagem`, estado `confirmarColagem` e o AlertDialog de colagem; `colarPadrao` reescrito para o novo fluxo. `copiarValores`/`copiarPadrao`/`PadraoMinimo` mantidos.
- Novos imports: `Dialog*`, `Checkbox`, ícone `Copy`.

## Não muda
Cálculos de sugerido/defasado/lead time, campo Adotado (OK, Enter, blur), "Aceitar todas", "Aceitar {sugerido}", popover de detalhe (todos os cliques novos com `stopPropagation`), somente leitura para não-admin/gestor.

## Verificação
Teste da função pura em /tmp (chave ligada/desligada, tamanho ausente no destino, sugerido do destino, iguais excluídos), sem temporários no repositório; typecheck e diff do arquivo ao final.
