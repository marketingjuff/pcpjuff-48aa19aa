## Escopo
Ajustes na aba "Disponível" do COP + persistência da seleção de COP entre abas. 100% TS/TSX, sem SQL.

## 1. `src/components/cop/DisponivelTab.tsx`

### Reagrupar `linhas` por COR → MODELO
- Substituir o `useMemo` `linhas` para iterar primeiro `coresDisponiveis` (alfabético pt-BR) e dentro de cada cor, `REFACAO_MODELOS`.
- Resultado: `{ cor, modelo }[]`. Cor repete em cada linha (sem rowspan).
- Manter filtros atuais (`corFiltro`, `apenasFaltando`, checagem `algumPresente`).

### Reordenar colunas: COR / MODELO / TAMANHOS / (coluna extra Total Geral)
- `thead` e `tbody`: Cor primeiro (badge `corHex`/`corTextoSobre`), depois Modelo, depois tamanhos.
- Adicionar coluna extra à direita: header vazio, células do corpo vazias (preenchida só no `tfoot`).

### Larguras e densidade
- Modelo: `min-w-[160px]` → `min-w-[64px]`.
- Cor: `min-w-[140px]` → `min-w-[56px]`.
- Tamanhos: `w-[70px]` → `w-[96px]` (no `th` e nas células).
- Padding: Cor/Modelo `p-2` → `px-2 py-1`; botões dos números `py-1` → `py-0.5`.

### `tfoot` com Total Geral
- Linha única refletindo apenas linhas visíveis (já filtradas).
- 1ª célula `colSpan={2}` (Cor+Modelo), texto **"Total Geral"** em negrito.
- 1 célula por tamanho: soma `disponivel.get(pkKey(cor, modelo, t)) ?? 0` sobre todas as linhas visíveis.
- Última célula: soma das somas. Negrito, mesma regra de cor (negativo vermelho / positivo verde).
- Estilo: `border-t-2 font-semibold bg-muted/30`, `tabular-nums`.

## 2. `src/components/cop/DashboardCopTab.tsx`
- Renomear rótulo do card "Saldo geral" → **"Total Geral"**. Não mexer no cálculo `saldoGeral`.

## 3. Seleção persistente de COP entre abas — `src/routes/_authenticated/cop.tsx`
- Criar estado único `const [copSelId, setCopSelId] = useState<string | null>(null)` no `CopHome`.
- Passar `selectedId={copSelId}` / `onSelect={setCopSelId}` somente para `CorteTab`, `RomaneioTab` e `PagamentoOficinasTab`.
- Nessas três abas: remover o `useState` interno de `selectedId`, aceitar via props, derivar `selected = cops.find(c => c.id === selectedId)` localmente a partir da própria query. Trocar chamadas `setSelectedId(...)` pela função recebida.
- Demais abas (Dashboard, Disponível, Falta por Pedido, Perdas) **inalteradas**.
- Não trocar aba ativa automaticamente. Se o id selecionado não estiver na lista filtrada da aba, ela apenas não destaca nada (sem erro, sem limpar o id). Manter `forceMount` nas `TabsContent`.

## Não fazer
- Sem total por linha, sem rowspan na cor, sem mudar `calcEmProducao/Faltantes/Baixado/Disponivel/saldoGeral`, sem mexer no popup de detalhes, sem SQL.
