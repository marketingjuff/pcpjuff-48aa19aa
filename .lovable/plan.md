
Três mudanças independentes.

## 1) Peça Lisa — formulário e gate de etapa (sem bloquear salvar)

**`src/components/pcp/DadosInTab.tsx`** (CardContent do Input de Produção):
- Envolver a "Linha 2" inteira (`Dias de Secagem`, `Arte (limite)`, `Início Estamparia`, `Término Estamparia`) em `{!isLisa && (<>...</>)}` — não renderiza para Lisa.
- "Início de Acabamento":
  - Se `isLisa`: renderizar `<Field label="Início de Acabamento"><DateInputBR value={form.inicio_acabamento} onChange={(v) => set("inicio_acabamento", v)} /></Field>`.
  - Caso contrário: manter read-only com `inicioAcabamentoCalc` (sem mudança).
- "Término de Acabamento", "Saída Juff" e "Tempo de Produção": sem mudança.
- Em `saveVendor` e `saveProducao`, no payload do `onSave`, trocar `inicio_acabamento: inicioAcabamentoCalc ?? form.inicio_acabamento ?? null` por `inicio_acabamento: isLisa ? (form.inicio_acabamento ?? null) : (inicioAcabamentoCalc ?? form.inicio_acabamento ?? null)`.
- **Não** adicionar gate de salvamento — salvar continua livre.

**`src/lib/pedidos.ts` › `calcularEtapaInterno`** (ramo `isLisa`):
- Substituir o atalho atual que joga direto para "Aguardando Acabamento" por uma checagem: só avança para "Aguardando Acabamento" quando `p.status_pecas === "completo"` **e** `notEmpty(p.inicio_acabamento)` **e** `notEmpty(p.termino_acabamento)`. Caso contrário, permanece em `"Aguardando input de produção"` (cor `yellow`).
- Sem alterações em outros ramos.

## 2) Observações em MAIÚSCULO (só visual)

Adicionar a classe Tailwind `uppercase` ao `className` dos `<Textarea>` de edição e dos blocos que exibem o texto (sem `.toUpperCase()` no valor; placeholders e labels intactos):

- `DadosInTab.tsx` — `obs_vendedor` e `observacoes_pedido`.
- `ArteTab.tsx` — `arte_observacao`.
- `DTFTab.tsx` — `dtf_observacao`.
- `SilkTab.tsx` — `silk_observacao`.
- `AcabamentoTab.tsx` — `acabamento_observacao`.
- `ExpedicaoTab.tsx` — `exp_observacoes`.
- `ObservacoesOutrosSetores.tsx` — bloco de exibição do texto.

## 3) Validação de datas no `saveProducao` (`DadosInTab.tsx`)

Antes do `onSave` e após os gates já existentes, comparando strings ISO `YYYY-MM-DD` com `<=` / `>=` (datas iguais permitidas). Manter a checagem dia útil de `termino_acabamento` (`isDataUtilISO`).

- Conjunto de datas relevantes:
  - Lisa: `inicio_acabamento`, `termino_acabamento`.
  - Demais: `arte_data`, `inicio_estamparia`, `termino_estamparia`, `inicio_acabamento` (usar `form.inicio_acabamento ?? inicioAcabamentoCalc`), `termino_acabamento`.
- **Janela `[entrada_pedido, saidaJuffCalc]`**: se alguma data acima estiver preenchida e faltar `form.entrada_pedido` ou `saidaJuffCalc`, bloquear com `toast.error("Defina Entrada do Pedido e Data de Entrega/Tempo de Frete (Saída Juff) antes de informar datas de produção.")`. Quando ambos existem, cada data preenchida deve satisfazer `entrada_pedido <= data <= saidaJuffCalc`; falha → marcar campo em `missingProd` e `toast.error("A data <Label> está fora da janela de produção (entrada do pedido até a Saída Juff).")`.
- **Ordem do fluxo** (só comparar pares onde ambas as datas existem); na primeira falha, dispara `toast.error` específico, marca o campo violador em `missingProd` e retorna:
  - Não-Lisa:
    - `arte_data <= inicio_estamparia` → "Início de Estamparia não pode ser anterior à Arte (limite)."
    - `inicio_estamparia <= termino_estamparia` → "Término de Estamparia não pode ser anterior ao Início de Estamparia."
    - `termino_estamparia <= inicio_acabamento` (efetivo) → "Início de Acabamento não pode ser anterior ao Término de Estamparia."
    - `inicio_acabamento <= termino_acabamento` → "Término de Acabamento não pode ser anterior ao Início de Acabamento."
  - Lisa:
    - `inicio_acabamento <= termino_acabamento` → mesma mensagem acima.

## Escopo / não-fazer
- Não mexer em outras rotinas de `pedidos.ts` além do ramo Lisa em `calcularEtapaInterno`.
- Sem mudanças de schema/banco.
