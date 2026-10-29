-- Permitir que admin exclua um mapeamento de produto da Olist.
GRANT DELETE ON public.olist_produto_map TO authenticated;

CREATE POLICY "produto_map_delete_admin" ON public.olist_produto_map
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));