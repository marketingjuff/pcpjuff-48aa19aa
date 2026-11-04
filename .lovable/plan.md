# Módulo PLAN — planejamento de peças e de tinturaria

Sexto módulo, em `/plan`, com botão laranja. Ele só faz sugestões: lê os dados do COP, MAP e Olist e grava somente nas duas tabelas novas.

## Banco (uma migração nova, apenas acrescenta)
Arquivo: `supabase/migrations/20261104190000_plan_modulo.sql`
- `CREATE TABLE IF NOT EXISTS plan_fichas_modelo` e `plan_config`, com as colunas especificadas.
- GRANT de SELECT/INSERT/UPDATE para `authenticated` e ALL para `service_role`. Sem acesso anônimo e sem DELETE.
- RLS: SELECT para `is_team_member()`, INSERT/UPDATE para `has_role(auth.uid(),'admin')`, seguindo o padrão de `olist_produto_map`. Policies criadas em bloco `DO $$ IF NOT EXISTS` para a migração poder rodar duas vezes.
- Seed com as 15 fichas e os 8 parâmetros, usando `ON CONFLICT DO NOTHING`.
- Os nomes das fichas conferem com `REFACAO_MODELOS`. "Regata Breeze" e "Não Identificado" ficam sem ficha, como no documento.

## Arquivos
1. `src/lib/permissoes.ts`: inclui `"plan"` em ModuloKey, MODULOS, as 3 permissões e o preset `plan_completo`. Nada existente muda.
2. `src/hooks/use-role.ts`: `useCanAccessPlan()` no mesmo padrão de `useCanAccessKpi()`.
3. `src/routes/_authenticated/cop.tsx`: altero somente o `MacroSwitch` (tipo `"plan"`, `canAccessPlan`, totalModulos e o botão laranja depois de KPI).
4. `src/lib/plan.ts`:
   - Funções puras: `kgPorPeca`, `demandaTotal`, `necessidadeLiquida`, `diasAteRuptura`, `arredondarLote`, `dataLimiteDecisao`.
   - Hooks somente leitura: fichas, config, venda histórica, disponível, estoque tingido, na tinturaria e cru parado.
   - A venda histórica reaproveita `apenasVigentes` e a regra atual de olist-vendas/indicadores-olist, além de `olist_produto_map`. Itens sem mapeamento vão para a lista de aviso.
   - O disponível usa `cop-saldos.ts` montado como em `DisponivelTab.tsx`, sem alterar esse arquivo.
   - Mutations atualizam linha por linha e invalidam as queries do PLAN. Assim, uma mudança de gramatura aparece nas outras abas sem recarregar.
5. `src/routes/_authenticated/plan.tsx`: segue a estrutura do KPI (abas via `?tab`, header, sair, configurações, MacroSwitch "plan", `useAbasPermitidas("plan")`, forceMount com montagem tardia). Quem não tem permissão é redirecionado por `rotaInicial`.
6. `src/components/plan/NecessidadeTab.tsx`:
   - Seletor de horizonte (3/5/6 meses) salvo no localStorage e 4 cards.
   - Grade com colunas PP a EXXG, Total e Situação, em sublinhas Vendido/Previsto que nunca se somam. Previsto tem fundo mais claro.
   - Cor em chip e zeros apagados. Ordem do mais crítico para o menos crítico, mantendo o par de sublinhas junto.
   - Cabeçalho congelado (`.tbl-congelada`, `max-h-[70vh]`), rolagem horizontal própria, tabela de conferência recolhida e texto explicativo.
7. `src/components/plan/TinturariaTab.tsx`: cards (incluindo cru parado por PROD), cartões de decisão por cor com prazo de 40 ou 65 dias conforme o cru e estado "atrasado", estado vazio, tabela completa recolhida com total e lote arredondado, e faixa da cadeia.
8. `src/components/plan/ParametrosTab.tsx`: só para admin e gestor. Inputs de texto com até 3 casas decimais e erro ao lado do campo. Ficha editável mostra o kg por peça calculado.

## Pontos a confirmar (vou seguir esta interpretação se não houver objeção)
- **Gestor na aba Parâmetros:** ele vê a aba, mas o banco só permite que admin salve, como o documento pede para as policies. Para gestor, os campos ficam somente leitura.
- **Distribuição do Previsto por tamanho:** usa a proporção de venda dos 12 meses daquele modelo/cor. Sem histórico de tamanho, usa a proporção do modelo inteiro.
- **Previsto líquido:** estoque e produção em andamento abatem primeiro o Vendido e depois o Previsto, por tamanho, com piso zero.
- **Kg da sugestão de tinturaria:** peças a produzir de cada cor multiplicadas pelo kg por peça do modelo. A sugestão desconta o tingido em estoque e o que está na tinturaria, e depois arredonda pelo lote mínimo.
- **"Tem cru":** significa que o cru parado total cobre a quantidade a tingir daquela cor. O cru é distribuído na ordem de urgência, sem ser contado duas vezes.

## Verificação
- Testes das funções puras fora do projeto, incluindo Camiseta 0,181 kg e Regata Move 0,111 kg. Nenhum temporário fica no repositório.
- Abrir `/plan` no navegador e rodar o typecheck, mostrando o resultado no final.
- Arquivos tocados limitados à allowlist e `cop-saldos.ts` intacto.
