## Plano de implementação — 12 alterações PCP Juff

### 1. Reordenar filtros do Dashboard Master
`DashboardTab.tsx` — reordenar a barra de filtros para: Etapa → Busca (Pedido + Orçamento) → Vendedor → Tipo de Estampa → Status de Peças → Data de Entrega.

### 2. Lisa vai direto para Acabamento
`src/lib/pedidos.ts` → `calcularEtapaAtual()`: se `tipo_estampa === "Lisa"`, retornar `"Aguardando Acabamento"` antes de qualquer outra checagem. Visibilidade em outras abas permanece como hoje.

### 3. Centralização em todas as abas
Em `AcabamentoTab`, `ArteTab`, `DTFTab`, `DadosInTab`, `ExpedicaoTab`, `SilkTab`, `DashboardTab`, `FinalizadosTab` e helpers em `shared.tsx`:
- `TableHead` (todos): `text-center`.
- `TableCell` (todos): `text-center`.
- Exceção: célula do campo Orçamento mantém `text-left`; o cabeçalho "ORÇAMENTO" fica `text-center`.

### 4. Linha em vermelho por atraso de setor
Adicionar destaque (`bg-destructive/10`, texto vermelho discreto) na linha quando:
- Arte: `arte_data < hoje` e `status_arte !== "Arte Finalizada"`.
- DTF: `inicio_estamparia < hoje` e `dtf_estampado !== "Sim"`.
- Silk: `inicio_estamparia < hoje` e `silk_feito !== "Sim"`.
- Acabamento: `saida_juff < hoje` e `embalado !== "Sim"`.
- Expedição: `saida_juff < hoje` e pedido não finalizado.

Implementar como helper `linhaAtrasoClasse(pedido, setor)` em `shared.tsx` e aplicar no `<TableRow>` de cada Tab.

### 5. Renomear labels de Vetorização (Arte)
`ArteTab.tsx`: "Vetorização de DTF" → "Vetorização de DTF Realizada"; "Vetorização de Silk" → "Vetorização de Silk Realizada".

### 6. Pré-preenchimento ao abrir pedido em Arte
`ArteTab.tsx`: ao carregar o pedido selecionado, se cada campo estiver vazio/null, definir defaults conforme tabela do briefing (Vetorização DTF/Silk = "Não" só quando `necessita_vetorizacao`; DTF Impresso/Cortado = "Não" se tipo inclui DTF; Fotolito Impresso = "Não" se tipo inclui Silk; `status_arte` = "Em andamento" exceto Lisa). Marcar o form como dirty para forçar salvar.

### 7. Painel superior da aba Arte (EtapaTopoBanner)
`ArteTab.tsx`:
- Rótulos: "DTF Finalizado" → "STATUS DTF"; "Fotolito Finalizado" → "STATUS FOTOLITO".
- `dtfFinalizadoLabel()` / `fotolitoFinalizadoLabel()`: trocar retorno "Sim" por "Finalizado".
- Colunas do painel: remover Data de Entrada e Data de Entrega; adicionar "Início Est." (`inicio_estamparia`). Ordem final: Data Limite | Início Est. | Saída Juff.

### 8. Dashboard da aba Arte
`ArteTab.tsx`: na tabela inferior remover coluna "Data de Entrada" e adicionar "Início Est." imediatamente antes de "Saída Juff".

### 9. Admin troca senha de outros usuários
- Nova server function `adminUpdateUserPassword` em `src/lib/admin.functions.ts` com `requireSupabaseAuth` + checagem `has_role(admin)`. Dentro do handler, `await import('@/integrations/supabase/client.server')` e chamar `supabaseAdmin.auth.admin.updateUserById(userId, { password })`. Validação Zod (mínimo 8 caracteres).
- Em `configuracoes.tsx`, exibir somente para admin: botão "Trocar senha" em cada usuário, abrindo dialog com campos "Nova senha" + "Confirmar senha"; ao confirmar, chamar a server fn via `useServerFn` e mostrar toast.

### 10. Observações de outros setores (componente reutilizável)
- Novo `src/components/pcp/ObservacoesOutrosSetores.tsx` que recebe `pedido` + `setorAtual` e renderiza, abaixo do textarea, lista compacta com mesmo tamanho do rótulo "Observações", no formato `Obs. <Setor> - <conteúdo>` para cada um dos 7 campos preenchidos, excluindo o setor atual e os vazios.
- Integrar em Arte, DTF, Silk, Acabamento, Expedição (abaixo do textarea de observação do setor).
- Em Dados In: exibir apenas abaixo de "Observação da Produção", excluindo Vendedor e Produção; lista contém apenas Arte, DTF, Silk, Acabamento, Expedição preenchidos.

### 11. Histórico completo em Finalizados
`FinalizadosTab.tsx`: ao clicar numa linha, abrir o mesmo `EtapaTopoBanner`/painel superior usado nas outras abas em modo somente leitura — todos os inputs `disabled`, sem botão Salvar — listando todas as datas de processo (entrada, arte, início_estamparia, dtf/silk, acabamento, saída_juff, entrega) e todas as 7 observações já formatadas.

### 12. Botões "Voltar" (apenas navegação)
Cor `#cf0e0e`, posicionado ao lado de "Baixar Layout". Apenas navegam entre abas, **sem alterar dados** (conforme escolha do usuário):
- `SilkTab`: "Voltar para a Arte" → aba Arte mantendo pedido selecionado.
- `DTFTab`: "Voltar para a Arte".
- `AcabamentoTab`: combinação condicional conforme tabela do briefing — "Voltar para DTF"/"Voltar para Silk" só aparecem quando a respectiva etapa estiver concluída; "Voltar para Produção" sempre disponível e navega para Dados In focando o input "Produção".

Navegação entre abas: usar o estado de aba existente em `_authenticated/index.tsx` (passar callback ou usar contexto/URL search param `?tab=arte&pedido=<id>`); manter pedido selecionado via search param já existente.

### Notas técnicas
- Toda lógica de status/atraso continua em `pedidos.ts` para reuso.
- Cor vermelha dos botões: estilo inline ou util `bg-[#cf0e0e] hover:bg-[#b00b0b] text-white`.
- Server fn de troca de senha requer `attachSupabaseAuth` já registrado (está).
- Nenhuma mudança de schema necessária.
