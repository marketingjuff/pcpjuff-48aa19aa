-- 1) olist_produto_map: unify write rules to admin-only (remove conflicting rules)
DROP POLICY IF EXISTS "produto_map_insert_admin_only" ON public.olist_produto_map;
DROP POLICY IF EXISTS "produto_map_update_admin_only" ON public.olist_produto_map;
DROP POLICY IF EXISTS "Admin e gestor podem criar mapeamento" ON public.olist_produto_map;
DROP POLICY IF EXISTS "Admin e gestor podem editar mapeamento" ON public.olist_produto_map;

CREATE POLICY "produto_map_insert_admin" ON public.olist_produto_map
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "produto_map_update_admin" ON public.olist_produto_map
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) pcp_capacidade_etapa: restrict reads to team members
DROP POLICY IF EXISTS "capacidade_select_authenticated" ON public.pcp_capacidade_etapa;

CREATE POLICY "capacidade_select_equipe" ON public.pcp_capacidade_etapa
  FOR SELECT TO authenticated
  USING (public.is_team_member());