## Objetivo

Tornar a seleção de COP **opcional** no dialog de baixa de peças faltantes (aba "Falta por Pedido" do COP). Adicionar campo de observação livre para anotações manuais. Liberar a quantidade a abater até o total em falta, sem amarração ao estoque do COP.

## Alterações

### 1. `src/lib/pedidos.ts` — tipo do log

Tornar campos de COP opcionais e adicionar `observacao`:

```ts
pecas_completadas_log?: Array<{
  modelo: string; cor: string; tamanho: string; qtd: number;
  em: string; por: string | null;
  cop_id?: string | null;
  cop_numero?: number | null;
  cop_letra?: string | null;
  observacao?: string | null;
}> | null;
```

### 2. `src/components/cop/BaixaCopDialog.tsx`

- Remover `Select` de COP, `candidatos`, `copId`, `copSel`, `capFor`, lógica de pré-preenchimento baseado em COP.
- Adicionar `Textarea` opcional "Observação (ex: COP 0001 e 0002, misturado)".
- Coluna "No COP" da tabela removida. Cap do input passa a ser apenas `it.falta`.
- Mudar assinatura de `onConfirm`: `(observacao: string, baixas) => void`.
- Botão "Confirmar baixa" habilitado quando `totalAbater > 0` (sem exigir COP).
- Manter `cops` removido das props (não é mais usado).

### 3. `src/components/cop/FaltaPorPedidoTab.tsx`

- Mutation `baixar`: aceitar `observacao?: string` no lugar de `copId`. Remover lookup de COP.
- Ao gravar `novoLog`, omitir `cop_id`/`cop_numero`/`cop_letra` (ou `null`) e incluir `observacao` se preenchida.
- Atualizar render do histórico (`details`) para mostrar a observação quando existir e ocultar `(COP ...)` quando não houver `cop_numero`.
- Callback `onConfirm={(observacao, baixas) => baixar.mutateAsync({ pedido, observacao, baixas })}`.

### 4. `src/components/pcp/PecasCompletadasPanel.tsx`

- Renderizar `(COP ...)` apenas quando `l.cop_numero != null`; exibir observação quando presente.

## Observações

- Não é necessária migração de schema: `pecas_completadas_log` é `JSONB`, então tornar campos opcionais é puramente tipagem TS.
- Registros antigos com `cop_id` continuam válidos e são exibidos normalmente.
