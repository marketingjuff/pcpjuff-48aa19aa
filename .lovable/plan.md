# Gráficos "Onde estamos perdendo": números nas barras e visual mais limpo

Mudança só visual, em um único arquivo: `src/components/cop/PerdasQuebrasPainel.tsx` (função `MiniCard` e a linha de import do recharts). Nenhum banco, cálculo, agrupamento, total ou clique muda.

## O que muda no MiniCard
1. Import: acrescentar `LabelList` ao import já existente de `recharts`.
2. Rótulo na ponta: `<LabelList dataKey="qtd" position="right">` com formatador `"{qtd} · {pct}%"`, `pct = Math.round(qtd / total * 100)` usando o total do próprio card (o mesmo exibido no título). Fonte 11px, `tabular-nums`, cor `hsl(var(--foreground))`. Margem direita do BarChart de 16 para 56.
3. Eixo X: `hide`, mantendo `type="number"` e `allowDecimals={false}`.
4. Eixo Y: `axisLine={false}`, `tickLine={false}`, `width={170}`, `tickFormatter` cortando nomes com mais de 28 caracteres para 27 + "…". O `dataKey` continua o nome completo, então tooltip e título do popup seguem com o nome inteiro.
5. Barras: `barSize={16}`, `radius={[0, 4, 4, 0]}`. Passa a sempre renderizar um `Cell` por barra:
   - "Por cor": `corHex(nome)`; se a cor for branco, areia, verde água ou amarelo (comparação sem acento/maiúscula), `stroke="#d1d5db"` fino.
   - Demais cards: `#9ca3af` para "Não informado", `#16a34a` para o resto.
6. Tooltip: `cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}`; conteúdo igual.
7. Altura: `Math.max(120, dados.length * 30 + 16)`.
8. `onClick` da barra intacto (mesmo popup).

## Ao final
Typecheck e diff completo do arquivo.
