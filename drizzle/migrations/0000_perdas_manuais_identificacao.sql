alter table public.perdas_manuais
  add column if not exists area_identificou text,
  add column if not exists erro_producao boolean,
  add column if not exists area_erro text,
  add column if not exists problema text;