## Correção do saldo "Disponível" do COP

### Bug
`Disponível = Produção − Faltantes`. Quando uma baixa zera `pecas_solicitadas` de um pedido e o trigger marca `status_pecas = 'completo'`, o pedido some de `calcFaltantes` e o Disponível volta para o total da Produção — como se as peças baixadas nunca tivessem saído.

### Correção
Usar o histórico imutável `pedidos.pecas_completadas_log` (varrendo todos os pedidos, sem filtrar status) como "Baixado":
```
Disponível = Produção − Faltante (pendente atual) − Baixado (histórico)
```

### Arquivos alterados

**1. `src/lib/cop-saldos.ts`**
- Nova função `calcBaixado(pedidos: Pedido[]): Map<string, number>` — soma `qtd` de cada entrada de `pecas_completadas_log` por `pkKey(modelo, cor, tamanho)`, percorrendo todos os pedidos.
- Alterar assinatura: `calcDisponivel(producao, faltantes, baixado?)` — `baixado` opcional (default Map vazio) para manter chamadas que não precisarem dele compilando; subtrai faltantes + baixado da produção.

**2. `src/components/cop/DisponivelTab.tsx`**
- `const baixado = useMemo(() => calcBaixado(pedidos), [pedidos])`.
- `calcDisponivel(producao, faltantes, baixado)`.
- `title` da célula: incluir `· Baixado {baix}`.
- Modal de detalhe: adicionar terceiro card "Baixado" (mesmo estilo neutro/azul) e ajustar Saldo = `prod − falt − baix`.

**3. `src/components/cop/DashboardCopTab.tsx`**
- `const baixado = useMemo(() => calcBaixado(pedidos), [pedidos])`.
- `calcDisponivel(producao, faltantes, baixado)` — propaga para "Saldo geral" e "Top urgências".

### Não tocado
- `calcFaltantes` e `calcEmProducao` permanecem como estão.
- Nenhuma migração, nenhuma mudança de schema, nenhuma outra lógica de COP/PCP.
