# PLAN — adiar linha e marcar como sob demanda

## Pré-requisito confirmado
`usePlanLinhas("corte" | "suprimento")` e `HorizonteCorteSelect` já estão no código, porque a rodada anterior foi concluída.

## Ajustes necessários no banco (precisam de aprovação)
1. **Local do arquivo:** neste projeto as migrações ficam em `drizzle/migrations/` (as do PLAN são `0002`/`0003`) e são aplicadas pela ferramenta de migração. Um arquivo novo em `supabase/migrations/` não seria aplicado. Proposta: gravar a migração em `drizzle/migrations/` com o SQL do pedido. Será o único arquivo novo fora da allowlist, e ele substitui o item da allowlist.
2. **Permissões de acesso (GRANT):** sem elas, a tela recebe "permissão negada" mesmo com as policies, porque o backend não libera a tabela nova sozinho. Acrescento apenas, antes do `ENABLE ROW LEVEL SECURITY`:
   `GRANT SELECT, INSERT, UPDATE ON public.plan_pausas TO authenticated;`
   `GRANT ALL ON public.plan_pausas TO service_role;`
   Não haverá DELETE para `authenticated` nem acesso anônimo.
3. **UPDATE policy:** acrescento `WITH CHECK (public.is_team_member())`, igual ao padrão da tabela `plan_config`. Fora isso, o SQL fica exatamente como no pedido. Quem pode pausar é qualquer membro da equipe, como foi pedido; não é só admin.

## Arquivo por arquivo

### `src/lib/plan.ts` (somente acréscimos)
- Tipos `PlanPausa` e `LinhaComPausa`.
- `usePlanPausas()`: lê as pausas com `retomado_em` nulo, usando `[...PLAN_KEY, "pausas"]` e `supabase.from("plan_pausas" as any)`, com paginação no padrão do arquivo. Expõe `pausas`, `isLoading`, `error`, `pausar({modelo, cor, tipo, ate, observacao})` e `retomar(id)`.
  - `pausar` primeiro fecha as pausas ativas do mesmo modelo e cor (preenche `retomado_em`/`retomado_por`, só nessas linhas) e depois insere a nova. Valida que adiado tem `ate` e que sob demanda tem `ate` nulo. Mostra toast e invalida `PLAN_KEY`. Também devolve o erro, para o popover exibir.
  - `retomar` preenche `retomado_em` e `retomado_por` (usuário logado). Mostra toast e invalida `PLAN_KEY`.
- `aplicarPausas({linhas, pausas, tamanhos, hoje})`: função pura com as regras 1 a 6 do pedido. A pausa vale se for sob demanda, ou se for adiada com `ate` maior ou igual a hoje (datas zeradas). Na cópia, `aProduzirPorTam` passa a ser igual ao firme e `aProduzir` à soma do firme. Os demais campos ficam intactos. Também guarda a sugestão cheia original, para os blocos e o aviso. A linha vai para `ativas` se `jaVendido > 0`, e para `pausadas` caso contrário. A ordenação é a pedida.
- Nada existente muda: `montarNecessidade`, `montarTinturaria` e os hooks atuais.

### `src/components/plan/NecessidadeTab.tsx`
- `usePlanLinhas` não muda, por isso a Tinturaria continua recebendo as linhas cheias.
- `NecessidadeTab`: chama `usePlanPausas()` e `aplicarPausas`. A tabela e os cards de total usam `ativas`. O carregamento das pausas entra no `isLoading`. Se a leitura das pausas falhar, a tela mostra o erro e usa as linhas sem filtro.
- Nova coluna à direita com botão de relógio (`aria-label="Adiar {modelo} {cor}"`). Ele abre um Popover com 15/30/60/90 dias (dias corridos), "Sob demanda, sem prazo", campo "Motivo, opcional" e "Confirmar". O erro aparece dentro do popover.
- Badge âmbar "Só pedido vendido" ao lado do modelo, com o title "Previsão adiada até dd/mm" ou "Previsão suspensa, produto sob demanda".
- Abaixo dos cards, um aviso: "N peças fora deste total, em M linhas adiadas ou sob demanda."
- No rodapé, os blocos recolhíveis "Adiados (N)" e "Sob demanda (N)", com modelo, CorChip, sugestão cheia, data, observação e "Retomar agora". Blocos vazios ficam ocultos.
- O bloco de cores fora de linha não muda.

## Verificação ao final
- Casos de `aplicarPausas` testados fora do repositório: vencida, valendo com firme, valendo sem firme, ordenação e campos preservados.
- Conferência de que a Tinturaria continua recebendo as mesmas linhas.
- Typecheck com o resultado mostrado, e o SQL final exatamente como gravado.
