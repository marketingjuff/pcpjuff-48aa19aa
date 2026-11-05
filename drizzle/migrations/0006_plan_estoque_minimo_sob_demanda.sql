alter table public.plan_estoque_minimo
  add column if not exists sob_demanda boolean not null default false;