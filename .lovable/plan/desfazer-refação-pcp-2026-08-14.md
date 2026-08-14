# Desfazer Refação (PCP)

Dar a admins e gestores um botão "Desfazer refação" que devolve o pedido ao estado exato de antes da refação: remove o episódio, restaura todos os campos apagados e faz o asterisco desaparecer da etapa. Nada é perdido — o episódio removido vai para um histórico de auditoria.

## O que muda

1. **Banco**: nova coluna `refacoes_desfeitas` em `pedidos` (append-only, guarda a auditoria de cada refação desfeita). Migração estritamente aditiva.
2. **Tipos** (`src/lib/pedidos.ts`): novo tipo `RefacaoDesfeita` (data, usuário, motivo, índice original, cópia do episódio, campos restaurados) e o campo opcional `refacoes_desfeitas` no tipo `Pedido`. Nada existente é alterado.
3. **Novo componente** `src/components/pcp/DesfazerRefacaoButton.tsx`.
4. **Integração** em `src/components/pcp/RefacaoViewerButton.tsx`: o botão aparece no cabeçalho do card do episódio, dentro do dialog "Visualizar dados de refação" (único ponto de entrada) — e `CAMPO_LABEL` passa a ser exportado para reuso.

## Regras do botão

- Só renderiza para role `admin` ou `gestor` (via `useMyRoles`, sem `areas_extras`). Para os demais, não aparece.
- Só no **último** episódio (`index === refacoes.length - 1`); refações anteriores se desfazem em cadeia.
- Desabilitado com tooltip quando o episódio tem perda reclassificada no Controle de Perdas (`reclassDoEpisodio.length > 0`).
- Aparência: `size="sm"`, `variant="outline"`, borda/texto vermelho, ícone `RotateCcw`.

## Dialog de confirmação

Mesmo padrão de `CorrigirEtapaButton.tsx` (`AlertDialog`), com:

- Explicação de que os campos voltam aos valores originais, o asterisco some e a perda deixa de contar nos indicadores e no Controle de Perdas.
- Lista dos campos que serão restaurados, com rótulos amigáveis e o valor original ao lado.
- Se o episódio não tiver snapshot (episódios antigos): aviso amarelo de que o episódio será removido mas os campos **não** serão restaurados automaticamente.
- Aviso fixo: COPs de reposição criados a partir da perda **não** são apagados automaticamente.
- **Motivo obrigatório** (`Textarea`, 3 linhas); confirmar fica desabilitado enquanto vazio.
- Botões: Cancelar / Confirmar e desfazer.

## Ação ao confirmar

Um único `update` em `pedidos` contendo:

1. Todos os pares chave/valor de `episodio.retrato.campos_apagados` (restauração total do snapshot, sobrescrevendo valores atuais).
2. `refacoes` sem o episódio daquele índice.
3. `refacoes_desfeitas` acrescido da nova entrada de auditoria.

Depois: toast de sucesso, invalidação de `["pedidos"]`, `["perdas-cons-pedidos"]`, `["perdas-cons-reclass"]` e fechamento do dialog. Em erro, toast de erro e dialog permanece aberto.

## Detalhes técnicos

SQL exato da migração (único statement):

```sql
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS refacoes_desfeitas jsonb NOT NULL DEFAULT '[]'::jsonb;
```

Sem `DROP`, `TRUNCATE`, `DELETE` ou recriação de tabela. Sem alteração de RLS/grants (a coluna herda as políticas existentes de `pedidos`).

Arquivos tocados — e apenas estes:

| Arquivo | Ação |
|---|---|
| `supabase/migrations/<nova>.sql` | criar |
| `src/lib/pedidos.ts` | adicionar tipo + campo |
| `src/components/pcp/DesfazerRefacaoButton.tsx` | criar |
| `src/components/pcp/RefacaoViewerButton.tsx` | montar botão + exportar `CAMPO_LABEL` |

Não serão tocados: `refacao-helpers.ts`, `RetrabalhoTab.tsx`, `RefacaoDialog.tsx`, `VoltarDropdown.tsx`, `perdas-consolidado.ts`, `cop-saldos.ts`, nem qualquer arquivo dos módulos COP, MAP, SUP ou KPI. Nenhuma assinatura de função existente muda e nenhum refactor de passagem será feito.

A remoção da perda do Controle de Perdas e dos indicadores de Retrabalho acontece automaticamente, pois esses números são derivados de `pedidos.refacoes`.
