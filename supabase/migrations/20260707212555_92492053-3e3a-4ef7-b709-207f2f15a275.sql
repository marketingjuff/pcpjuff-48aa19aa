
DROP POLICY IF EXISTS map_select ON public.map_estoque_pecas;
DROP POLICY IF EXISTS map_insert ON public.map_estoque_pecas;
DROP POLICY IF EXISTS map_update ON public.map_estoque_pecas;
DROP POLICY IF EXISTS map_delete ON public.map_estoque_pecas;

CREATE POLICY map_select ON public.map_estoque_pecas FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_area(auth.uid(), 'map'::text));
CREATE POLICY map_insert ON public.map_estoque_pecas FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_area(auth.uid(), 'map'::text));
CREATE POLICY map_update ON public.map_estoque_pecas FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_area(auth.uid(), 'map'::text))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_area(auth.uid(), 'map'::text));
CREATE POLICY map_delete ON public.map_estoque_pecas FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_area(auth.uid(), 'map'::text));
