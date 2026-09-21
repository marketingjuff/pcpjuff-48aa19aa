# Expedição edita o Frete + Retorno do pedido da aba Frete para a Expedição

Sem migração e sem SQL. Apenas 2 arquivos: `src/components/pcp/ExpedicaoTab.tsx` e `src/components/pcp/FreteTab.tsx`.

## 1. `src/components/pcp/ExpedicaoTab.tsx` — Frete editável

- Adicionar `const { names: fretesLista } = useAppList("frete");` junto dos hooks de lista já existentes.
- `freteOpcoes` via `useMemo`: lista configurável + o valor atual de `form.frete` no início, caso ele não exista mais na lista (nunca desaparece do Select).
- Trocar, na mesma terceira célula da grade (entre Orçamento e UF), o `ReadOnlyField label="Frete"` por um `FormField` com `Select` alimentado por `freteOpcoes` e `set("frete", v)`. Nenhum campo é reordenado; o `fieldset disabled={soLeitura}` existente já cuida do somente leitura.
- Acrescentar `frete: form.frete ?? null` ao payload de `handleSave` e ao de `handleFinalizar`.
- Nada mais muda: `marcarTudoSim`, `pendenciasDoPedido`, `todosCompletos`, `itensParaForma`, dashboard e o import de `ReadOnlyField` (ainda usado nos outros campos) ficam intactos.

## 2. `src/components/pcp/FreteTab.tsx` — Retornar para Expedição

- Novos imports: componentes de `@/components/ui/alert-dialog` e `Undo2` de `lucide-react`.
- Novo estado `retornoAlvo: Pedido | null`.
- `confirmarRetorno()`: fecha o diálogo e chama `onSave` com exatamente `{ id, exp_destino_humberto: false, exp_despachado: null, exp_despachado_em: null }` + toast de sucesso. Nenhuma chave de canhoto ou de entrega confirmada entra no payload.
- Nova última coluna "Ações" (após Foto) no header e no corpo, com botão "Retornar para Expedição" (`outline`, `size="sm"`), renderizado só quando não é somente leitura, desabilitado quando `saving` ou `entrega_confirmada_em` preenchido, com `title` explicando o bloqueio.
- Um único `AlertDialog` no fim do componente com o título, a descrição, "Cancelar" e "Devolver para a Expedição" exatamente como especificado.
- Filtros, geração de canhotos, troca de foto, checkbox de horário comercial e ordenação ficam intactos. O pedido sai da aba naturalmente porque o filtro `exp_destino_humberto === true` deixa de bater.

## O que não muda

`src/lib/pedidos.ts` (cálculo de status), `src/lib/entregas.ts`, `shared.tsx`, `DadosInTab.tsx`, `/entregas`, `app-lists.ts`, `types.ts`, `package.json`, `cop-saldos.ts`. `tempo_frete`, `data_entrega` e `saida_juff` continuam exclusivos do Dados In.

## Ao final

Typecheck e diff resumido por arquivo.
