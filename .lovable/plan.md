## Parte A — Travar exclusão por papel

**A.1 Migration RLS em `pedidos`**
- DROP POLICY `pedidos_delete_team`
- CREATE POLICY `pedidos_delete_admin_gestor` FOR DELETE TO authenticated USING `has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor')`

**A.2 `src/components/pcp/DadosInTab.tsx`**
- Importar `useIsAdmin` e `useHasRole` de `@/hooks/use-role`
- `const podeDeletar = useIsAdmin() || useHasRole('gestor')`
- Envolver o botão "Deletar" + seu `AlertDialog` em `{podeDeletar && (...)}`

**A.3 Finalizados** — não tocar.

---

## Parte B — Paginação no Finalizados (`src/components/pcp/FinalizadosTab.tsx`)

- Estados novos: `loteTamanho` (50/100/200, default 100) e `visiveis` (default = `loteTamanho`)
- Select "Mostrar por tela" com 50/100/200 no header, ao lado dos filtros existentes (sem mexer no filtro de data)
- `useEffect` que reseta `visiveis = loteTamanho` quando muda: filtro de data, busca, ou `loteTamanho`
- `const finalizadosVisiveis = finalizados.slice(0, visiveis)` — usado tanto nos cards (mobile) quanto na tabela (desktop)
- Rodapé: contador "mostrando X de Y" + botão "Carregar mais" (incrementa `visiveis += loteTamanho`), visível só se `visiveis < finalizados.length`
- Seleção em massa do admin (selecionar todos / Excluir Selecionados) passa a operar sobre `finalizadosVisiveis`, não sobre o array filtrado completo

---

## Fora de escopo
Outras policies de delete (storage, layouts, feriados), filtro de data do Finalizados, qualquer outro comportamento.
