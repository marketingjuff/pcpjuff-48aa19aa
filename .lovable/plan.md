# Status "Saiu para entrega" / "Entregue" (fluxo Humberto)

Sem migração de banco — todos os campos já existem. Apenas os 4 arquivos do allowlist.

## 1. `src/lib/pedidos.ts` — função `calcularEtapaInterno` (cadeia if/else, ~linha 392)

Inserir dois estados entre `p.finalizado_em` e `acabamentoOk`:

- `acabamentoOk && exp_destino_humberto === true && entrega_confirmada_em` → **"Entregue"** (verde)
- `acabamentoOk && exp_destino_humberto === true` → **"Saiu para entrega"** (azul)

`Finalizado` mantém precedência; pedidos sem destino Humberto seguem em "Aguardando Expedição".
`percentual` e o sufixo de asteriscos das refações ficam intactos.

## 2. `src/components/pcp/shared.tsx`

- `ETAPA_FILTRO_OPCOES` (linha 477): duas opções novas entre `expedicao` e `finalizados`
  (`saiu_entrega`, `entregue`).
- `_ETAPA_MAP` (linha 493): `saiu_entrega: ["Saiu para entrega"]`, `entregue: ["Entregue"]`.
- `ETAPA_FILTRO_OPCOES_EXPEDICAO` (linha 547): incluir os dois valores na ordem
  `ativas, acabamento, expedicao, saiu_entrega, entregue, finalizados`.
- `matchEtapaFiltro` não muda.

## 3. `src/components/pcp/ExpedicaoTab.tsx`

- Novo helper `aguardandoEntregaHumberto(p)` junto de `todosCompletos`/`pendenciasDoPedido`.
- Nova prop opcional `podeForcarFinalizacao?: boolean` (default `false`) na interface `Props`.
- **Faixa no card do pedido** (abaixo de `FaixaSomenteLeitura`): âmbar com ícone `Truck`
  quando aguardando entrega; verde com `CheckCircle2` e "Entregue em DD/MM às HH:MM"
  quando confirmada. Só aparece se `exp_destino_humberto === true`.
- **Botão "Finalizar Pedido"** (linha ~345): `disabled` também quando aguardando entrega e
  sem override; `title` específico. Com `podeForcarFinalizacao`, o clique abre um
  `AlertDialog` "Finalizar sem confirmação de entrega?" — confirmar executa
  `handleFinalizar()`, cancelar não faz nada.
- **Lote**: checkboxes das linhas (desktop e mobile) desabilitados quando bloqueado;
  "selecionar todos" opera só sobre os elegíveis (checked/indeterminate nesse subconjunto);
  handler de "Finalizar selecionados" filtra os ids bloqueados e emite `toast` de alerta
  "X pedido(s) não finalizado(s): aguardando confirmação de entrega do Humberto."
- **Badge na lista**: "Com o Humberto" (âmbar) / "Entregue" (verde) nos cards mobile e na
  célula de pendências da tabela desktop.

## 4. `src/routes/_authenticated/index.tsx`

No `<ExpedicaoTab>` (linha ~338), adicionar
`podeForcarFinalizacao={isAdmin || (isGestor && pode("pcp.expedicao"))}` — mesmo critério já
usado em `canReabrir` do `FinalizadosTab`. Nada mais muda.

## Não muda

Aba Frete, tela `/entregas`, fluxo Correios/transportadora, `src/lib/cop-saldos.ts`,
COP/MAP/SUP/KPI, cores e `supabase/migrations/`.
