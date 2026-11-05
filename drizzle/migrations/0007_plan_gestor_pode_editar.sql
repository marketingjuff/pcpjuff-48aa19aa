-- PLAN: gestor também edita (parâmetros gerais, fichas de encaixe, cores fora de linha)
-- 1) plan_config: insert/update passam a aceitar admin OU gestor
drop policy if exists "plan_config_insert_admin" on public.plan_config;
drop policy if exists "plan_config_update_admin" on public.plan_config;
create policy "plan_config_insert_write" on public.plan_config
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'gestor'::public.app_role));
create policy "plan_config_update_write" on public.plan_config
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'gestor'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'gestor'::public.app_role));

-- 2) plan_fichas_modelo: insert/update passam a aceitar admin OU gestor
drop policy if exists "plan_fichas_modelo_insert_admin" on public.plan_fichas_modelo;
drop policy if exists "plan_fichas_modelo_update_admin" on public.plan_fichas_modelo;
create policy "plan_fichas_modelo_insert_write" on public.plan_fichas_modelo
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'gestor'::public.app_role));
create policy "plan_fichas_modelo_update_write" on public.plan_fichas_modelo
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'gestor'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'gestor'::public.app_role));

-- 3) map_config / chave plan_cores_fora_de_linha: admin OU gestor
--    (restritiva continua bloqueando a chave para qualquer outro papel)
drop policy if exists "plan_cores_fora_linha_insert_admin" on public.map_config;
drop policy if exists "plan_cores_fora_linha_update_admin" on public.map_config;
drop policy if exists "plan_cores_fora_linha_delete_admin" on public.map_config;
create policy "plan_cores_fora_linha_insert_write" on public.map_config as restrictive
  for insert to authenticated
  with check (key <> 'plan_cores_fora_de_linha' or public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'gestor'::public.app_role));
create policy "plan_cores_fora_linha_update_write" on public.map_config as restrictive
  for update to authenticated
  using (key <> 'plan_cores_fora_de_linha' or public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'gestor'::public.app_role))
  with check (key <> 'plan_cores_fora_de_linha' or public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'gestor'::public.app_role));
create policy "plan_cores_fora_linha_delete_write" on public.map_config as restrictive
  for delete to authenticated
  using (key <> 'plan_cores_fora_de_linha' or public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'gestor'::public.app_role));

--    (permissiva: gestor do PLAN grava nesta chave mesmo sem ter a área map)
create policy "plan_cores_fora_linha_insert_gestor" on public.map_config as permissive
  for insert to authenticated
  with check (key = 'plan_cores_fora_de_linha' and (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'gestor'::public.app_role)));
create policy "plan_cores_fora_linha_update_gestor" on public.map_config as permissive
  for update to authenticated
  using (key = 'plan_cores_fora_de_linha' and (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'gestor'::public.app_role)))
  with check (key = 'plan_cores_fora_de_linha' and (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'gestor'::public.app_role)));
create policy "plan_cores_fora_linha_delete_gestor" on public.map_config as permissive
  for delete to authenticated
  using (key = 'plan_cores_fora_de_linha' and (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'gestor'::public.app_role)));