DROP POLICY IF EXISTS cop_perdas_gestor_delete ON public.cop_perdas;
DROP POLICY IF EXISTS cop_perdas_gestor_insert ON public.cop_perdas;
DROP POLICY IF EXISTS cop_perdas_gestor_select ON public.cop_perdas;
DROP POLICY IF EXISTS cop_perdas_gestor_update ON public.cop_perdas;

CREATE POLICY cop_perdas_gestor_select ON public.cop_perdas
  FOR SELECT
  USING (has_role(auth.uid(), 'gestor'::app_role) AND has_area(auth.uid(), 'cop'));

CREATE POLICY cop_perdas_gestor_insert ON public.cop_perdas
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'gestor'::app_role) AND has_area(auth.uid(), 'cop'));

CREATE POLICY cop_perdas_gestor_update ON public.cop_perdas
  FOR UPDATE
  USING (has_role(auth.uid(), 'gestor'::app_role) AND has_area(auth.uid(), 'cop'))
  WITH CHECK (has_role(auth.uid(), 'gestor'::app_role) AND has_area(auth.uid(), 'cop'));

CREATE POLICY cop_perdas_gestor_delete ON public.cop_perdas
  FOR DELETE
  USING (has_role(auth.uid(), 'gestor'::app_role) AND has_area(auth.uid(), 'cop'));