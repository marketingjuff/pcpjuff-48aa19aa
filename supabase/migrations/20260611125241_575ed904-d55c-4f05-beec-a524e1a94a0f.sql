
CREATE POLICY "layouts_select_auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'layouts');
CREATE POLICY "layouts_insert_auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'layouts');
CREATE POLICY "layouts_update_auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'layouts');
CREATE POLICY "layouts_delete_auth" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'layouts');
