# Aposentar "Motivos de perda": correções usam área + problema

## Banco (única migração, aditiva)
- `perdas_reclassificacoes`: `area_erro_novo text`, `erro_producao_novo boolean` (ADD COLUMN IF NOT EXISTS). Sem backfill, sem tocar em `app_lists`. Tipos regenerados automaticamente.

## Arquivo por arquivo
1. `src/lib/app-lists.ts`
   - `useKindProblemaPorArea`: área encontrada retorna sempre `kindProblemaDaArea(area.id)` (remove a troca para `motivo_perda` com lista vazia). Sem área: igual a hoje.
   - `useOpcoesErro`: remove a leitura de `motivo_perda`; área sem problemas fica `problemas: []`.
2. `src/lib/config-listas-catalogo.ts`: remove o item "Motivos de perda".
3. `src/lib/cop.ts`: `PerdaItemRef` ganha `area_erro?`, `problema?`, `erro_producao?`; no ramo `correcao_perda` de `lancamentosPerda`, copia esses três de `ev.depois` quando `area_erro` não vazio, e inclui-os em `alvo.original` quando não há `ev.antes`.
4. `CorrigirLancamentoPerdaDialog.tsx`: linhas com `area_erro`/`erro_producao`; select agrupado igual ao `RegistrarPerdaDialog` (valor `área||problema`, gatilho `área · problema`, coluna 260px, sem "—"); linha inicial vem com área/motivo do lançamento se houver área; não salva sem problema ("Escolha o problema de todas as linhas."); `itens` e `antes` levam os três campos; remove imports órfãos.
5. `RomaneioTab.tsx`: só o `map` dos `extras` do evento "Desmembrado da correção" passa os três campos.
6. `CorrigirPerdaDialog.tsx`: "Problema novo *" com o select agrupado; erro "Selecione o problema novo."; insert grava `motivo_novo`, `area_erro_novo`, `erro_producao_novo`.
7. `perdas-consolidado.ts`: na fonte reclass, preenche `area_erro`, `erro_producao`, `problema` a partir dos campos novos.

## Ponto de atenção
`RefacaoDialog.tsx` (protegido) tem `useAppList(kindProblema ?? "motivo_perda")` na linha 75. Como `useKindProblemaPorArea` nunca retorna null, esse texto é inalcançável, mas vai sobrar na busca do critério 2. Não vou mexer nele.

## Verificação
Typecheck e diff completo. Sem lançamentos de teste, porque o preview grava no banco real.
