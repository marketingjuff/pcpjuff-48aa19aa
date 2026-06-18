Conforme suas instruções, vou trabalhar **um bloco por vez**. Este plano cobre **apenas a PARTE 1 (bugs)**. Depois do seu OK, abro outro plano para a PARTE 2 (A1–A11), também em blocos.

Sem criar arquivos novos, sem mexer fora do escopo, reaproveitando o que já existe.

---

## B1 — Dashboard não atualiza após alteração

**Causa provável:** após salvar um pedido em uma aba, as outras (Dashboard, abas de setor) leem de cache do TanStack Query e não revalidam.

**Correção:**
- Centralizar a invalidação no `mutate`/save de pedido em `src/lib/pedidos.ts` (ou no hook de update usado pelas abas).
- Após cada update bem-sucedido, chamar `queryClient.invalidateQueries` para as queries usadas por `DashboardTab`, `DadosInTab` e abas de setor (mesma queryKey raiz dos pedidos).
- Garantir que `DashboardTab` use a mesma queryKey (sem variação por filtro local) para receber a invalidação.

**Verificação:** editar data de entrega de um pedido em uma aba → Dashboard reflete na hora, sem reload.

---

## B2 — Dados somem ao avançar de etapa

**Causa provável:** ao calcular `etapaAtual` em `pedidos.ts` o pedido muda de aba, e o form da aba antiga foi resetado/desmontado antes de persistir os campos ("Sim" + data de finalizado, ex.: fotolito).

**Correção:**
- Revisar o submit das abas Arte/DTF/Silk: garantir que **todos** os campos do form (status + datas finalizadas) vão no payload do update, não só os "ativos".
- Não limpar campos de etapa anterior ao avançar (`calcularEtapaAtual` só deve ler, nunca apagar).
- Confirmar que após o update o refetch traz os mesmos valores (encadeado com B1).

**Verificação:** marcar "Fotolito Impresso = Sim" + data na Arte, avançar para Silk, voltar para Arte → valores preservados.

---

## B3 — Status "Fotolito" aparece indevidamente

**Correção em `ArteTab.tsx`:**
- Renderizar os campos/labels de Fotolito **apenas** quando `tipo_estampa` inclui Silk (Silk ou Silk+DTF).
- Para "só DTF": ocultar Fotolito no card de Arte, na tabela e no `ObservacoesOutrosSetores` quando aplicável.
- Mesma regra na coluna FOTOLITO da dashboard da Arte (se existir).

**Verificação:** pedido só DTF não exibe nenhum campo de Fotolito na Arte.

---

## B4 — Renomear "DTF Impresso (Arte)" → "Pedido pronto para estampar?"

**Mesmo campo, sem migração de banco** (mantém a coluna atual, só muda label + lógica de cálculo):
- Em `ArteTab.tsx`: trocar label para **"Pedido pronto para estampar?"** (Sim/Não).
- Lógica: o valor só é **Sim** automaticamente quando `dtf_impresso === true` **E** `dtf_cortado === true` (campos já existentes). Caso contrário, **Não**.
- Se hoje o campo é editável manualmente, passar a ser **derivado** (read-only) a partir de impresso+cortado, para evitar inconsistência.
- Atualizar qualquer label visível em DTFTab/Dashboard que cite "DTF Impresso (Arte)" para o novo nome (apenas label, sem mudar chave/coluna).

**Verificação:** marcar só impresso → "Não". Marcar impresso + cortado → "Sim". DTF vê o novo nome.

---

## Fora de escopo neste bloco
A1–A11 ficam para o próximo plano após seu OK nos bugs.

**Posso seguir com B1–B4?**