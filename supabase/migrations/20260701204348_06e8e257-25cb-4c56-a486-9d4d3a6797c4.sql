DROP POLICY IF EXISTS oficinas_admin_all ON public.oficinas;
CREATE POLICY oficinas_admin_gestor_cop_all ON public.oficinas
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR (has_role(auth.uid(),'gestor'::app_role) AND has_area(auth.uid(),'cop')))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR (has_role(auth.uid(),'gestor'::app_role) AND has_area(auth.uid(),'cop')));