## Ajustes nos cálculos automáticos (aba Dados de Entrada)

Arquivo: `src/components/pcp/DadosInTab.tsx` (linhas 103-112)

### 1. Data de saída Juff com frete = 0
Hoje, quando `tempo_frete` é `0` (ou vazio), `saidaJuffCalc` retorna `null` e o campo mostra "—".

Mudança: tratar `0` como valor válido. Se houver `data_entrega` e o tempo de frete for `0`, a data de saída Juff fica igual à data de entrega.

```ts
const tempoFreteNum = Number(form.tempo_frete ?? NaN);
const saidaJuffCalc = useMemo(() => {
  if (!form.data_entrega || !Number.isFinite(tempoFreteNum)) return null;
  if (tempoFreteNum === 0) return form.data_entrega;
  return addDiasUteis(form.data_entrega, -tempoFreteNum, feriados);
}, [form.data_entrega, tempoFreteNum, feriados]);
```

### 2. Tempo de produção = 0 deve aparecer como "0"
Com o ajuste acima, `tempoProducaoCalc` passa a ser calculável quando frete = 0. Para garantir que `0` (ou valores negativos por sobreposição de datas) apareçam como `0` e não como "—", clampar o resultado a 0 mínimo. O display `{tempoProducaoCalc ?? "—"}` (linha 486) já renderiza `0` corretamente, basta nunca devolver `null` quando há dados válidos.

```ts
const tempoProducaoCalc = useMemo(() => {
  if (!form.entrada_pedido || !saidaJuffCalc) return null;
  const ultimoDiaProducao = addDiasUteis(saidaJuffCalc, -1, feriados);
  const d = diasUteisEntre(form.entrada_pedido, ultimoDiaProducao, feriados);
  return Math.max(0, d);
}, [form.entrada_pedido, saidaJuffCalc, feriados]);
```

Nenhuma outra área (persistência, listagens) precisa ser tocada — os valores calculados continuam sendo salvos em `saida_juff` e `tempo_producao` pelos handlers existentes (linhas 165-166 e 199-200).