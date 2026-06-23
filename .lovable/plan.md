## Ajustes na refação (6 itens)

A lógica geral da refação permanece. Cada item é pontual.

---

### 1. Remover campo "peças extras" do popup de Refazer
**Arquivo:** `src/components/pcp/RefacaoDialog.tsx`
- Remover state `pecasExtras`, bloco `mostraExtras`, validação relacionada e `pecas_extras` do payload enviado.
- Remover `pecas_extras` do tipo `RefacaoFormPayload`.
- O aumento de produção passa a ser controlado exclusivamente por `perda_pecas` (campo já existente, obrigatório quando há perda).

---

### 2. Perda de peças soma no total de produção
**Arquivo:** `src/lib/pedidos.ts` — função `totalProducao`
- Trocar soma de `pecas_extras` dos episódios por soma de `perda_pecas`.
- Pedido de 500 com 50 perdidas → total 550.
- `QtdTotal` em `shared.tsx` continua exibindo `550 (500 +50)` — sem alteração no componente.
- `pecas_extras` deixa de ser usado em qualquer cálculo.

---

### 3. Refação não escreve mais em observações
**Arquivo:** `src/components/pcp/refacao-helpers.ts`
- `montarRefacoesAposRefazer` passa a retornar apenas `{ refacoes }` (remover geração e retorno de `observacoes_pedido`).
- Remover `montarLinhaObservacao` se ficar sem uso.
- Nas abas que chamam essa função (Acabamento e demais), remover a aplicação de `observacoes_pedido` no payload do save da refação.
- Dados da refação ficam apenas no array `refacoes`.

---

### 4. Motivo imutável no editor de episódios
**Arquivo:** `src/components/pcp/RetrabalhoTab.tsx` — `EpisodioEditor`
- Trocar `<Textarea>` do campo Motivo por exibição somente leitura (texto fixo).
- Demais campos do editor permanecem editáveis.

---

### 5. Botão laranja "Visualizar dados de refação"
**Arquivos:** `DadosInTab.tsx`, `ArteTab.tsx`, `DTFTab.tsx`, `SilkTab.tsx`, `AcabamentoTab.tsx`, `ExpedicaoTab.tsx`
- Adicionar botão laranja (`#ff8c2f`) ao lado do botão azul de salvar/atualizar.
- Visível apenas quando `pedido.refacoes` não estiver vazio.
- Ao clicar, abre dialog read-only com episódios: etapa origem→destino, data, responsável, peças a refazer, peças perdidas, adesivos perdidos (se houver), motivo e retrato das etapas.
- Extrair/reaproveitar o card de leitura que já existe em `RetrabalhoTab.tsx` (criar componente compartilhado, ex.: `RefacaoViewerDialog.tsx`).

---

### 6. Bug: observações do Dados In iguais às do Acabamento
**Migração Supabase:** adicionar coluna `acabamento_observacao` (text, nullable) na tabela `pedidos`.

**Arquivo:** `src/components/pcp/AcabamentoTab.tsx`
- "Observações do Acabamento" passa a ler e salvar em `acabamento_observacao` (textarea + pick/payload do `handleSave`).
- Não usar mais `observacoes_pedido` no Acabamento.

**Arquivo:** `src/integrations/supabase/types.ts` — atualizado automaticamente após a migração.

`ObservacoesOutrosSetores` já lê `acabamento_observacao` para o setor Acabamento — após a mudança, cada aba mostra a observação correta de cada setor.

---

### Ordem de execução
1. Migração Supabase (item 6) — primeiro, pois regenera types.
2. Itens 1, 2, 3, 4 em paralelo (arquivos independentes).
3. Item 5 (novo componente compartilhado + edição das 6 abas).
4. Item 6 (código) após types regenerados.
