## Ignorar logs de pedidos sem solicitação atual no cálculo de "Baixado"

### Alteração
Em `src/lib/cop-saldos.ts`, modificar `calcBaixado` para pular pedidos cujo `pecas_solicitadas` esteja vazio ou ausente:

```ts
export function calcBaixado(pedidos: Pedido[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of pedidos) {
    // Pular pedidos sem solicitação atual (testes ou solicitações limpas):
    // se não há nada pedido, o log histórico não deve afetar o Disponível.
    const solic = p.pecas_solicitadas ?? [];
    if (solic.length === 0) continue;
    const log = (p as any).pecas_completadas_log as Array<...> | null | undefined;
    if (!Array.isArray(log)) continue;
    for (const item of log) { ... soma normal ... }
  }
  return m;
}
```

### Efeito
- Pedido "0000 teste" (e similares) cujas solicitações foram zeradas deixam de contribuir → a linha "preto" desaparece do Disponível.
- Pedidos reais com solicitações ativas continuam contando o histórico normalmente.

### Trade-off conhecido
Se no futuro um pedido legítimo tiver suas peças totalmente baixadas e depois o vendedor usar "Liberar para Completo" (que limpa `pecas_solicitadas`), essas baixas também sumirão do Disponível. Aceito conforme sua escolha.

### Arquivos
- `src/lib/cop-saldos.ts` — apenas `calcBaixado`. Nenhum outro arquivo, nenhuma migração.
