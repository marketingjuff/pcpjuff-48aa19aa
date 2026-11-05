# PLAN — nova aba "Estoque mínimo"

## O que muda para quem usa
- Nova aba "Estoque mínimo" no PLAN, entre "O que mandar tingir" e "Parâmetros".
- Blocos por modelo, agrupados por cor, com uma linha por tamanho (PP a EXXG): média por mês, mínimo sugerido, mínimo adotado, situação e "Aceitar sugestão".
- O mínimo adotado fica fixo até alguém mudar. Quando a sugestão passa do adotado além do limite (padrão 10%), a linha aparece como "Defasado", com fundo vermelho claro.
- Ao clicar numa linha, aparece a conta em frases simples. O tempo de reposição vem do histórico de COP. Se houver menos de 5 produções, usa a média geral; sem essa média, usa o parâmetro.
- Admin e gestor editam. Operador só visualiza, com a mesma tarja âmbar de Parâmetros.

## Pontos conferidos no banco/código
- Assinaturas reais: `has_role(_user_id uuid, _role app_role)` e `is_team_member()`. As chamadas do SQL pedido batem e não precisam de ajuste.
- Presets: o único que contém `plan.necessidade`/`plan.tinturaria` é "PLAN completo". Ele usa `permissoesDoModulo("plan")`, então inclui a chave nova sozinho. Nada é alterado em PRESETS.

## Três desvios necessários (precisam do seu ok)
1. **Local do arquivo:** neste projeto, a ferramenta de banco grava as migrações em `drizzle/migrations/0005_plan_estoque_minimo.sql`, e não em `supabase/migrations/`. Isso também mexe em `drizzle/migrations/meta/_journal.json` e no snapshot, que são gerados automaticamente. Foi o mesmo caminho das migrações 0002 a 0004 do PLAN.
2. **GRANTs obrigatórios:** sem eles, o app não consegue ler nem gravar a tabela, mesmo com RLS. Acrescento só isto, logo após o `create table`:
   ```sql
   grant select, insert, update on public.plan_estoque_minimo to authenticated;
   grant all on public.plan_estoque_minimo to service_role;
   ```
   Também acrescento `to authenticated` nas três policies. O efeito continua o mesmo, porque anônimos não têm GRANT. Não há DELETE nem policy de DELETE.
3. **Linha de `plan_config`:** a ferramenta de migração não aceita inserir dados. O `insert ... on conflict (chave) do nothing` do `limiar_alerta_minimo_pct = 10` roda direto no banco, com o mesmo SQL. Foi assim que entrou o horizonte de corte. Fora isso, o SQL fica idêntico ao pedido.

## SQL da migração
```sql
create table if not exists public.plan_estoque_minimo (
  id uuid primary key default gen_random_uuid(),
  modelo text not null,
  cor text not null,
  tamanho text not null,
  minimo_adotado integer not null default 0,
  sugerido_na_adocao integer,
  adotado_em timestamptz not null default timezone('America/Sao_Paulo', now()),
  adotado_por uuid,
  unique (modelo, cor, tamanho)
);
grant select, insert, update on public.plan_estoque_minimo to authenticated;
grant all on public.plan_estoque_minimo to service_role;
alter table public.plan_estoque_minimo enable row level security;
create policy "plan_estoque_minimo_select_team" on public.plan_estoque_minimo
  for select to authenticated using (public.is_team_member());
create policy "plan_estoque_minimo_insert_gestor" on public.plan_estoque_minimo
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'gestor'));
create policy "plan_estoque_minimo_update_gestor" on public.plan_estoque_minimo
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'gestor'));
create index if not exists plan_estoque_minimo_modelo_idx
  on public.plan_estoque_minimo (modelo, cor, tamanho);
```
Executado à parte: o `insert into public.plan_config ... on conflict (chave) do nothing` exatamente como no pedido.

## Arquivo por arquivo
- **types.ts:** só a regeneração automática, que a ferramenta faz.
- **src/lib/permissoes.ts:** a entrada `plan.estoque_minimo` entra entre tinturaria e parametros. Nada mais muda.
- **src/lib/plan.ts:** só acréscimos.
  - `usePlanLeadTimePorModelo()`: busca paginada em `cops` com recebimento nos últimos 12 meses. Os dias contam do risco, ou do corte quando falta o risco, até o recebimento. Ficam de fora valores negativos e acima de 180 dias. Calcula a mediana por modelo (mínimo de 5 amostras), a mediana geral e a amostra de cada modelo.
  - `leadTimeDoModelo`, `minimoSugerido` e `montarEstoqueMinimo` são funções puras, seguindo as regras do pedido: fora de linha excluídas, defasagem pelo limiar, ordem modelo, cores canônicas e tamanhos.
  - `usePlanMinimos`, `useSalvarMinimo` e `useSalvarMinimosEmLote` fazem upsert em (modelo, cor, tamanho), gravam o usuário logado e invalidam `PLAN_KEY`.
- **src/components/plan/EstoqueMinimoTab.tsx (novo):** segue o layout aprovado.
  - Topo com contador, busca e o interruptor "Mostrar só os defasados".
  - Blocos colapsáveis por modelo, faixa de cor com `CorChip` e tabela com a faixa agrupadora sobre Sugerido e Adotado, com filetes.
  - Campo de texto só inteiro, até 5 dígitos, que salva no blur. Placeholder mostra o sugerido.
  - Popover com o detalhe da conta e AlertDialog em "Aceitar todas deste modelo".
  - Erros de gravação aparecem na própria tela. Usa os estilos de `table-styles.ts`.
- **src/routes/_authenticated/plan.tsx:** a aba nova segue o padrão `montada()`/`forceMount`/`hidden` com `pode("plan.estoque_minimo")`, sem restrição de papel.

Arquivos protegidos e dependências: nenhum é tocado.

## Verificação
- Testes das funções puras em /tmp, fora do repositório, sem sobrar arquivos: sugestão, lead time e defasagem.
- Typecheck com o resultado mostrado.
- Diff completo dos arquivos alterados.
