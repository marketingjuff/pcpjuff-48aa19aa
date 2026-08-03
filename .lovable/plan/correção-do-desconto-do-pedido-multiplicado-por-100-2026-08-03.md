# Correção do desconto do pedido multiplicado por 100

Arquivos tocados: `src/lib/olist-vendas.ts` e `src/components/kpi/ImportacaoOlistTab.tsx` (só o aviso). Nenhuma migração, nenhum `UPDATE`, nenhum outro arquivo.

## 1. `num()` — leitura tolerante aos dois formatos

Mantém a guarda de número nativo. Para texto:

1. limpa moeda/espaços, preservando `0-9`, `.`, `,`, `-`;
2. se contém vírgula → formato BR: apaga os pontos, vírgula vira ponto;
3. sem vírgula e casando `^-?\d{1,3}(\.\d{3})+$` → ponto é milhar: apaga os pontos;
4. sem vírgula e fora desse padrão → ponto é decimal: mantém;
5. inválido/vazio → `0`.

| Entrada | Saída |
|---|---|
| `503.99` (número) | 503.99 |
| `"503.99"` | 503.99 |
| `"503,99"` | 503.99 |
| `"1.234,56"` | 1234.56 |
| `"1.234"` | 1234 |
| `"R$ 90,00"` | 90 |
| `"-989,10"` | −989.10 |
| `""` | 0 |
| `"abc"` | 0 |

## 2. `parseDesconto()`

- `typeof v === "number"` → `desconto_valor = v`, `desconto_percentual = null`, `desconto_original = String(v)` (não passa mais por `String()` antes de converter).
- texto com `%` → percentual via `num()`, como hoje.
- texto sem `%` → valor via `num()` corrigida.
- valor e percentual seguem mutuamente exclusivos.

## 3. Varredura do arquivo

Único ponto com o padrão "`String(...)` antes de `num()`" é `parseDesconto`. Os demais usos passam o valor cru da planilha direto para `num()`, então já se beneficiam da guarda de número nativo e da nova regra de texto:

- `frete`, `despesas` (pedido);
- `quantidade`, `valor unitario`, `desconto item` (item).

`dataBr` e `normalizarVendedor` usam `String()` mas não são numéricos — ficam como estão. `num()` de outros arquivos não é alterada.

## 4. Pedidos com desconto suspeito (prévia, sem bloquear)

Campo novo e aditivo em `ResultadoImportacaoVendas`:

```ts
pedidosDescontoSuspeito: {
  numero_pedido: string; subtotal: number; desconto: number; liquido: number; motivo: string;
}[]
```

Cálculo depois do parse, a partir dos itens já lidos: `subtotal = Σ(qtd × valor_unitario − desconto_item)` por pedido; `desconto` = `desconto_valor` ou `subtotal × pct/100`; `liquido = subtotal − desconto + frete + despesas`. Marca suspeito quando `desconto > subtotal` ou `liquido < 0`.

Quando a planilha traz `Desconto do pedido rateado`, a soma do rateio do pedido é acumulada durante a leitura e comparada com o desconto do pedido: divergência acima de R$ 0,05 também marca suspeito (motivo próprio).

## 5. Aviso na importação

Na prévia de `ImportacaoOlistTab.tsx`, se a lista não estiver vazia: bloco amarelo de aviso, não bloqueante, com "N pedido(s) com desconto suspeito — confira antes de gravar" e a tabela pedido · subtotal · desconto · líquido · motivo. A gravação continua liberada.

## 6. Dados já gravados

Nada de script. A importação é append-only por lote e o painel usa a versão vigente (lote mais recente por pedido, `apenasVigentes`), então reimportar o mesmo zip depois da correção substitui os valores errados sem apagar histórico. Não encontrei motivo para isso não funcionar.

## 7. Verificação

Casos da tabela do item 1 conferidos manualmente; 16601 → R$ 591,91; 16602 → R$ 80,52; 16626 → R$ 606,60; `"13%"` inalterado; typecheck limpo.
