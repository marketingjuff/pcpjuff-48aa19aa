
-- cop_perdas: allow gestor to insert/update/delete
CREATE POLICY cop_perdas_gestor_insert ON public.cop_perdas
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY cop_perdas_gestor_update ON public.cop_perdas
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY cop_perdas_gestor_delete ON public.cop_perdas
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'));

-- oficinas: allow any team member to read
CREATE POLICY oficinas_team_select ON public.oficinas
  FOR SELECT TO authenticated
  USING (public.is_team_member());
