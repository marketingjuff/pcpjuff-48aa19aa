
DROP POLICY IF EXISTS cops_select_gestor ON public.cops;

CREATE POLICY cops_select_cop_access ON public.cops
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_area(auth.uid(), 'cop'));

CREATE POLICY cops_insert_cop_access ON public.cops
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_area(auth.uid(), 'cop'));

CREATE POLICY cops_update_cop_access ON public.cops
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_area(auth.uid(), 'cop'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_area(auth.uid(), 'cop'));

CREATE POLICY cops_delete_cop_access ON public.cops
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
