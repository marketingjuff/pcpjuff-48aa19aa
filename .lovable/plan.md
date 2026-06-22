# Etapa 2 — Trava de Edição por Etapa

## Objetivo
Operadores só editam o pedido **enquanto a tarefa daquela aba está pendente**. Depois disso a aba vira somente leitura. Admin/gestor sempre editam. Dados In e Expedição não mudam.

## Regra de "editável" por aba

Centralizar em um helper único `src/components/pcp/edicao-policy.ts`:

```ts
canEditArte(p)        = !p.finalizado_em && p.tipo_estampa !== "Lisa" && p.status_arte !== "Arte Finalizada"
canEditDTF(p)         = !p.finalizado_em && tipoIncluiDTF(p.tipo_estampa) && p.dtf_estampado !== "Sim"
canEditSilk(p)        = !p.finalizado_em && tipoIncluiSilk(p.tipo_estampa) && p.silk_feito !== "Sim"
canEditAcabamento(p)  = !p.finalizado_em && p.embalado !== "Sim"
                        && etapaAtualSemAsterisco(p) === "Aguardando Acabamento"
                        // mesma condição já usada no Dashboard Master
```

Reaberto da Expedição (`reaberto === true` e parado lá) cai naturalmente nos casos acima: `embalado === "Sim"`, então Arte/DTF/Silk/Acab ficam todos travados para operador. Expedição segue com Refazer.

## Permissão final por aba

```
editavel = isManager || canEditX(pedido)
```

`isManager` (admin + gestor) já existe no `_authenticated/index.tsx`. Vamos passar para cada Tab como prop `canManage: boolean` (rename para evitar conflito conceitual com "manager" de tabela).

## Mudanças por arquivo

**1. `src/components/pcp/edicao-policy.ts` (novo)**
- Exporta `canEditArte/DTF/Silk/Acabamento(pedido)`.
- Exporta `useReadOnly(pedido, aba, canManage): boolean` que devolve `!(canManage || canEditX(p))`.

**2. `src/routes/_authenticated/index.tsx`**
- Passar `canManage={isManager}` para `<ArteTab>`, `<DTFTab>`, `<SilkTab>`, `<AcabamentoTab>`.

**3. `ArteTab.tsx`, `DTFTab.tsx`, `SilkTab.tsx`, `AcabamentoTab.tsx`**
Para cada uma:
- Aceitar prop `canManage: boolean`.
- Calcular `const readOnly = !(canManage || canEditX(selected))`.
- Aplicar `disabled={readOnly || ...condições já existentes}` em **todos** os inputs, selects, checkboxes, textareas, multiselects, date pickers e botões de ação interna do formulário (incluindo o `RefazerDropdown`/`VoltarDropdown` se for ação do operador — confirmar: refazer fica disponível para operador? O documento não menciona; manter Refazer só onde já existe e travar igual aos outros campos, exceto na Expedição).
- Esconder (não apenas desabilitar) o botão "Atualizar X" quando `readOnly`. Manter o restante da UI (cabeçalho, badges, lista de pedidos, "Baixar layout", observações em modo visual) renderizando normalmente.
- Observações/anotações: também desabilitadas quando `readOnly` (são parte do formulário da aba).

**4. Banner sutil de aviso (opcional, recomendado)**
Quando `readOnly && !canManage`, exibir uma linha discreta no topo do formulário: *"Esta etapa já foi concluída para este pedido. Visualização somente leitura."* Usa componentes existentes (`<Alert variant="default">` ou texto simples). Sem ícones coloridos novos.

## O que NÃO muda
- Dados In, Expedição, Finalizados, Retrabalho, Dashboard.
- Lógica de negócio, mutations, cálculo de etapa, refação.
- Estilos/layout dos formulários.
- Visibilidade das abas no menu (já controlada por `canSee`).

## Validação
1. Operador Arte abre pedido com `status_arte = "Arte Finalizada"` → campos desabilitados, sem botão Atualizar.
2. Operador DTF abre pedido com `dtf_estampado = "Sim"` → idem.
3. Mesmo pedido aberto por gestor → tudo editável.
4. Pedido reaberto (`embalado = "Sim"`, `reaberto = true`) → Arte/DTF/Silk/Acab travados para operador; Expedição funciona normal.
5. Pedido Lisa → Arte travada para operador (não se aplica).

Aguardo aprovação para implementar.
