-- Somente admin pode criar/alterar mapeamentos de produto (restritivas, somam-se às atuais)
CREATE POLICY "produto_map_insert_admin_only"
  ON public.olist_produto_map
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "produto_map_update_admin_only"
  ON public.olist_produto_map
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));