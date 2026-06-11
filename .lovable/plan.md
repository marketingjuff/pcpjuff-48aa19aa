## Diagnóstico

Encontrei **dois bugs** que explicam a inconsistência ao trocar o tipo de estampa (ex.: DTF+Silk → DTF):

### Bug 1 — Tabs sobrescrevem o tipo recém-alterado (root cause principal)

Em `ArteTab`, `DTFTab`, `SilkTab` e `AcabamentoTab` o `form` local é hidratado **uma única vez por pedido**:

```ts
useEffect(() => { if (selected) setForm(selected); }, [selected?.id]);
```

Quando o usuário edita `tipo_estampa` na Dados In e salva, o `pedidos` atualiza via realtime → `selected` muda, mas as outras abas continuam com `form.tipo_estampa = "DTF+Silk"` em memória. No próximo `Salvar` numa dessas abas o handler envia `{ ...form, id }` ao Supabase, **revertendo `tipo_estampa` para o valor antigo** (e todos os demais campos da aba). Mesma classe de bug acontece se duas pessoas editam o mesmo pedido em abas diferentes.

### Bug 2 — Mudança de tipo não limpa campos da técnica abandonada

Ao trocar `DTF+Silk → DTF`, os campos de Silk preenchidos (`silk_feito`, `tela_gravada`, `fotolito_impresso`, `fotolito_executado`, `silk_data_executada`, `quem_bateu_silk`, `silk_observacao`) permanecem no banco. Como a aba Silk passa a esconder o pedido, esses dados ficam "fantasmas" e quebram cálculos de etapa/acabamento (ex.: `acabamentoCompleto` ignora Silk, mas o histórico fica sujo). Análogo nos sentidos:

- `DTF+Silk → Silk` → limpar DTF
- `DTF+Silk → Lisa` → limpar DTF e Silk
- `DTF → Silk`, `Silk → DTF`, `* → Lisa` etc.

## Correções

### 1. Salvar apenas os campos editados na aba (patch, não full row)

Cada aba de processo passa a salvar **apenas o subconjunto de campos pertinente** à etapa, em vez de `{ ...form, id }`:

- `ArteTab.handleSave` → envia `{ id, status_arte, dtf_impresso, dtf_executado, fotolito_impresso, fotolito_executado, vetorizacao_executada, arte_observacao }`.
- `DTFTab.handleSave` → `{ id, dtf_estampado, dtf_data_executada, quem_bateu_dtf, dtf_observacao }`.
- `SilkTab.handleSave` → `{ id, tela_gravada, silk_feito, silk_data_executada, quem_bateu_silk, silk_observacao }`.
- `AcabamentoTab.handleSave` → `{ id, embalado, responsavel_acabamento, data_saida_juff, observacoes_pedido, finalizado_em? }`.

Isso elimina qualquer chance de uma aba sobrescrever `tipo_estampa` (ou outros campos fora do seu escopo) com dados stale.

### 2. Re-sincronizar `form` quando `selected` muda no servidor

Atualizar o efeito de hidratação para reagir a mudanças do registro, e não só do id, **preservando** edições locais do usuário pendentes (via `isDirty`):

```ts
useEffect(() => {
  if (!selected) { setForm({}); return; }
  if (!isDirty) setForm(selected); // só rehidrata se o usuário não tem alterações pendentes
}, [selected, isDirty]);
```

Aplicar nas 4 abas de processo e na Dados In (substituindo o `setForm(selected ?? empty)` atual pela versão guardada).

### 3. Resetar campos da técnica ao trocar `tipo_estampa` na Dados In

No `onValueChange` do Select de "Tipo de Estampa", além de `set("tipo_estampa", v)`, limpar os campos que deixam de ser aplicáveis:

```ts
function setTipoEstampa(v: string) {
  setForm((f) => {
    const next = { ...f, tipo_estampa: v };
    if (!tipoIncluiDTF(v)) Object.assign(next, {
      dtf_impresso: null, dtf_executado: null, dtf_estampado: null,
      dtf_data_executada: null, quem_bateu_dtf: null, dtf_observacao: null,
    });
    if (!tipoIncluiSilk(v)) Object.assign(next, {
      fotolito_impresso: null, fotolito_executado: null, tela_gravada: null,
      silk_feito: null, silk_data_executada: null, quem_bateu_silk: null, silk_observacao: null,
    });
    if (v === "Lisa") Object.assign(next, { status_arte: null });
    return next;
  });
}
```

Assim a persistência (graças à correção 1, que envia `tipo_estampa` + esses nulls juntos) fica consistente em uma única transação.

## Teste após implementar

No preview, abrir o pedido `11111`, trocar `tipo_estampa` de `DTF+Silk` → `DTF`, salvar, navegar para Arte/Silk/DTF/Acabamento e verificar via `supabase--read_query` que `tipo_estampa = 'DTF'` permanece após salvar em qualquer aba e que os campos de Silk ficaram nulos.

## Arquivos afetados

- `src/components/pcp/DadosInTab.tsx` — `setTipoEstampa`, hidratação guardada por `isDirty`.
- `src/components/pcp/ArteTab.tsx` — `handleSave` em patch + hidratação.
- `src/components/pcp/DTFTab.tsx` — idem.
- `src/components/pcp/SilkTab.tsx` — idem.
- `src/components/pcp/AcabamentoTab.tsx` — idem.
- `src/components/pcp/dirty-form-context.tsx` — expor `isDirty` consumido nas abas (já exporta).
