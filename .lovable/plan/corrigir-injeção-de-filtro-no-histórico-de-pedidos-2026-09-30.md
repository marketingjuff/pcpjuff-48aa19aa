# Corrigir injeção de filtro no histórico de pedidos

## O que muda
Só a validação do número Olist recebido pela busca de histórico. Um valor com vírgula, parênteses, espaço ou outro caractere que monte filtro é recusado antes de consultar o banco.

## Arquivo único: `src/lib/pedido-historico.functions.ts`
No `inputValidator`, trocar:

```ts
pedidoOlist: z.string().optional(),
```

por:

```ts
pedidoOlist: z
  .string()
  .max(40)
  .regex(/^[A-Za-z0-9._-]+$/)
  .optional(),
```

- `pedidoId` continua `z.string().uuid().optional()`.
- Handler, `.or()`, `order("feito_em")`, `limit(500)`, `PedidoAuditEntry` e a assinatura de `getPedidoHistorico` ficam idênticos.
- Sem checagem de papel, sem erro/log novo, sem refatoração.

## Fora do escopo
- Nenhum outro arquivo, nenhuma migração, nenhum SQL, nenhuma dependência.
- O diálogo já envia `pedidoOlist || undefined`, então texto vazio não chega à validação; números como 3996 e 3996A passam.

## Ao final
Rodar o typecheck e entregar o resultado junto com o diff completo do arquivo.
