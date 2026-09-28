CREATE POLICY lily_images_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lily-images' AND (storage.foldername(name))[1] = public.current_household()::text);