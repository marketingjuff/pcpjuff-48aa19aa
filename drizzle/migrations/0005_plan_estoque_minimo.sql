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