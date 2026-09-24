# COP — rolagem no diálogo de oficina e finalizados ocultos no popup Disponível

Sem migração, sem SQL, sem consulta nova. Apenas 2 arquivos.

## 1. `src/components/cop/CopConfigPanel.tsx` (só `OficinaDialog`)
- `DialogContent`: `max-w-[900px] max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0`.
- `DialogHeader`: `px-6 pt-6 pb-3 shrink-0` (fixo no topo).
- Novo `<div className="flex-1 overflow-y-auto px-6 pb-4 space-y-3">` envolvendo a grade de dados e o bloco "Tabela de valor por peça por modelo" (sem mudar campos, rótulos, ordem).
- `DialogFooter`: `shrink-0 border-t bg-background px-6 py-3` (fixo na base).
- `handleSave`, estados e `CoresCopCard` intocados.

## 2. `src/components/cop/DisponivelTab.tsx` (só a 1ª tabela do popup)
- Novo estado `mostrarFinalizados` (false), resetado para false sempre que `popup` mudar (`useEffect` em `popup`).
- Depois de `const lista = pedidosDoItem(...)`:
  - `influencia(item)` = `pedido.status_pecas === "incompleto"` e falta (mesma conta da linha: `qtd - qtd_enviada`) > 0.
  - `ocultos` = itens com `pedido.finalizado_em` preenchido e que não influenciam.
  - `visiveis` = `mostrarFinalizados ? lista : lista sem ocultos`.
- Acima da tabela, alinhado à direita, se `ocultos.length > 0`: botão de texto pequeno "`N finalizados ocultos, mostrar`" / "`ocultar finalizados`".
- Linha de pedido com `finalizado_em`: `Badge` pequeno "Finalizado" ao lado do orçamento.
- Mensagem de vazio igual à atual.
- Cabeçalho (Produção, Faltantes, Recebido, Perdas, Saldo) e tabela de COPs sem alteração.

## Ao final
`bunx tsgo --noEmit -p tsconfig.json` + diff completo dos dois arquivos.
