DROP POLICY IF EXISTS oficinas_admin_gestor_cop_all ON public.oficinas;
CREATE POLICY oficinas_admin_gestor_cop_all ON public.oficinas
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR (has_role(auth.uid(), 'gestor'::app_role) AND has_area(auth.uid(), 'cop'::text)))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR (has_role(auth.uid(), 'gestor'::app_role) AND has_area(auth.uid(), 'cop'::text)));