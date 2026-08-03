# Casar pedidos parciais do PCP (3996A / 3996B) com o pedido único da Olist

Nenhuma migração, nenhum `UPDATE`. Toda a agregação acontece em memória, na leitura.

## 1. Arquivo novo: `src/lib/pedido-olist-match.ts`

```ts
export function basePedidoOlist(numero: string | null | undefined): string;
```

Normaliza (`trim`, remove espaços internos), depois:

- casa `^(\d+)[A-Za-z]{1,2}$` → devolve só os dígitos;
- só dígitos → devolve como está;
- qualquer outro formato → devolve o texto normalizado (não agrupa).

| Entrada | Saída | Por quê |
|---|---|---|
| `"3996A"` | `3996` | dígitos + 1 letra |
| `"3996"` | `3996` | número puro |
| `"3996a"` | `3996` | letra minúscula, mesma base |
| `"3996 A"` | `3996` | espaço interno removido |
| `"3996AB"` | `3996` | até 2 letras |
| `"3996ABC"` | `3996ABC` | 3 letras: formato inesperado, não agrupa |
| `"16601"` | `16601` | inalterado |
| `""` / `null` | `""` | fica fora do mapa |
| `"PED-99/X"` | `PED-99/X` | texto estranho preservado |

### Agregação

```ts
export interface PcpAgregado {
  base: string; parciais: string[]; registros: PcpDb[];
  qtd: number; uf_entrega: string | null; vendedor: string | null;
  entrada_pedido: string | null; data_entrega: string | null;
  saida_juff: string | null; finalizado_em: string | null; parcial: boolean;
}
export function agruparPcpPorPedidoOlist(registros: PcpDb[]): Map<string, PcpAgregado>;
```

- ordena parciais pelo sufixo (sem letra primeiro, depois A, B, C…);
- **qtd** = soma de todos os parciais (único campo somado); refações e perdas também somam;
- todos os outros campos vêm do primeiro parcial, com fallback para o próximo parcial que tiver
  valor não vazio;
- `pedido_olist` vazio/nulo continua fora do mapa;
- `parcial = registros.length > 1`;
- `label` legível para a tela: `3996 (3996A + 3996B)` quando parcial, senão só `3996`.

## 2. Pontos onde o casamento por texto exato acontece hoje, e o que muda

| Local | Hoje | Depois |
|---|---|---|
| `IndicadoresTab.tsx` ~338-347 (`ufPorPedido`, `noPcp`, `pcpPorPedido`) | chave = `pedido_olist` cru, `set` sobrescreve parciais | montados a partir de `agruparPcpPorPedidoOlist`; chave = base |
| `IndicadoresTab.tsx` ~367 (`soPcp`) | bases cruas contra `numsOlist` | compara bases; `3996` na Olist elimina `3996A`/`3996B` |
| `IndicadoresTab.tsx` ~527 (`vendidoVsProduzido`) | recebia registro de um parcial só | recebe `pcpPorPedido` com qtd somada → `3996` compara com 2.000 |
| `IndicadoresTab.tsx` ~557 e ~566 (`soPcpLista`, `soPcpRegs`) | `Map` por número cru | `Map` por base; `soPcpRegs` usa o agregado |
| `IndicadoresTab.tsx` ~600 (`ufMapaDrill`) | mapa por número cru | mapa por base (UF do primeiro parcial) |
| `indicadores-vendedor.ts` `mapaVendedorPcp` | chave por número cru | chave por base, vendedor do primeiro parcial |
| `indicadores-drill.ts` `idPcp` / `drillSoPcp` / nota do `drillSoOlist` | identidade = `pedido_olist` | continua **uma linha por parcial**, mas ganha coluna "Pedido Olist" (base) + marcador de parcial; `drillSoPcp` filtra por base; nota de rodapé reescrita explicando base + letra |
| `ImportacaoOlistTab.tsx` ~125-133 (`setPcp`, `casam`, `soOlist`) | `Set` de números crus | `Set` de bases → pedido com parciais conta como casado |

`pcpPorPedido` continua sendo um `Map<string, PcpDb>` para não mexer em `indicadores-olist.ts`:
o valor é um `PcpDb` sintético montado do agregado (campos do primeiro parcial + qtd somada),
com o registro original preservado dentro de `PcpAgregado` para o drill.

## 3. Intocados

- `src/lib/kpi-pcp.ts` e `src/components/kpi/KpiPcpTab.tsx`: `produtividadePcp` continua tratando
  `3996A` e `3996B` como duas ordens de produção separadas. Confirmado: nenhum arquivo dessa aba
  entra na alteração.
- `src/lib/indicadores-olist.ts`: só leitura.
- COP, MAP, demais abas do PCP, cálculo de faturamento: nada muda.

## 4. Pontos de dúvida

- Sufixo de até 2 letras foi assumido conforme o regex do enunciado; `3996ABC` fica sem agrupar.
- Onde o drill mostra "Qtd" por parcial, mantenho a qtd real do parcial (1.000 cada) e a soma
  aparece só nos blocos agregados — juntar ali distorceria o dado de produção.
