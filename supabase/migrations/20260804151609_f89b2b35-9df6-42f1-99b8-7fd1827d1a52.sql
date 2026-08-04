REVOKE EXECUTE ON FUNCTION public.sup_proximo_numero_pc(date) FROM anon;

CREATE POLICY "sup_anexos_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'sup-anexos' AND (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup'))));

CREATE POLICY "sup_anexos_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sup-anexos' AND (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup'))));

CREATE POLICY "sup_anexos_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'sup-anexos' AND (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup'))))
WITH CHECK (bucket_id = 'sup-anexos' AND (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup'))));

CREATE POLICY "sup_anexos_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'sup-anexos' AND (public.has_role(auth.uid(),'admin'::public.app_role) OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'sup'))));