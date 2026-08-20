# Pedido só sai do Acabamento com o Acabamento completo

Sem migração. Apenas os 4 arquivos da allowlist.

## 1. `src/lib/pedidos.ts`

- Novo helper exportado, junto dos demais helpers de completude:

```ts
export function acabamentoPronto(p: Pedido): boolean {
  return (
    p.embalado === "Sim" &&
    notEmpty(String(p.data_saida_juff ?? "").trim()) &&
    notEmpty(String(p.responsavel_acabamento ?? "").trim())
  );
}
```

`MultiSelectPeople` serializa os nomes numa única string (ex.: `"ANA, JOÃO"`); vazio vira `""` ou `null`. O `.trim()` aplicado antes do `notEmpty` cobre string só com espaços, sem alterar `notEmpty` (usado em vários lugares).

- Linha 378: `const acabamentoOk = p.embalado === "Sim";` passa a
  `const acabamentoOk = !!p.expedicao_entrou_em || acabamentoPronto(p);`
- Nada mais muda: ordem dos `if`, ramos "Entregue" / "Saiu para entrega" / "Aguardando Expedição", `percentual`, sufixo de asteriscos e `acabamentoCompleto()` ficam intactos.

## 2. `src/components/pcp/edicao-policy.ts`

- `canEditAcabamento`: `if (p.embalado === "Sim") return false;` → `if (acabamentoPronto(p)) return false;`
- Importar `acabamentoPronto` de `@/lib/pedidos`. `canEditArte/DTF/Silk` e `isReadOnly` não mudam.

## 3. `src/components/pcp/AcabamentoTab.tsx`

- **Faltantes em tempo real**: derivar do mesmo `pick`-equivalente (`form[k] ?? selected[k]`) uma lista `faltamAcabamento: string[]` com `"Data da Embalagem"` e/ou `"Responsável pelo Acabamento"`, válida só quando `embalado === "Sim"`.
- **Carimbo** (linha ~99): condição passa a `acabamentoPronto({ ...selected, ...payload }) && !selected.expedicao_entrou_em` — mesma regra da etapa.
- **Banner** amarelo (`border-warning/30 bg-warning/10`, ícone `AlertTriangle`) logo **acima** da linha dos botões de ação do card, texto: "Este pedido continua no Acabamento. Para seguir para a Expedição, ainda falta preencher: **X e Y**."
- **Texto informativo** existente trocado por: "Ao salvar com EMBALADO=Sim, Data da Embalagem e Responsável preenchidos, o pedido vai automaticamente para a Expedição."
- **Toast**: em `handleSave`, se `embalado === "Sim"` e houver faltantes → `toast.warning("Pedido salvo, mas segue no Acabamento: falta ...")`; o salvamento prossegue (vale também no auto-save de `useRegisterSave`). Importar `toast` de `sonner`.
- Botão Salvar continua sempre habilitado. `responsavel_conferencia` intocado.

## 4. `src/components/pcp/ExpedicaoTab.tsx`

- Terceiro caso na renderização condicional: `selected && !selected.finalizado_em && !selected.expedicao_entrou_em` → card de aviso (warning) com título "Pedido {pedido_olist} ainda não entrou na Expedição", texto explicativo e botão "Ir para o Acabamento" → `onNavigate?.("acabamento")`.
- `selected === null` continua com o `EmptyState` atual. `dashboardPedidos`, `expedicaoPedidos`, filtros e ordenação não mudam.

## Regressões verificadas por leitura

Pedidos já na Expedição protegidos por `!!expedicao_entrou_em`; KPI/Monitor/CorrigirEtapa leem a etapa calculada; `percentual` usa o mesmo array de etapas (Lisa incluído); refação zera `expedicao_entrou_em` e volta a exigir os três campos — comportamento desejado.
