-- Allow thread participants to upload images to their chat folder
CREATE POLICY "Upload Chat Media" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'private-media' AND
  (storage.foldername(name))[1] = 'chats' AND
  EXISTS (
    SELECT 1 FROM public.threads
    WHERE id = (storage.foldername(name))[2]
    AND auth.uid() = ANY(participants)
  )
);

-- Allow thread participants to view images in their chat folder
CREATE POLICY "View Chat Media" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'private-media' AND
  (storage.foldername(name))[1] = 'chats' AND
  EXISTS (
    SELECT 1 FROM public.threads
    WHERE id = (storage.foldername(name))[2]
    AND auth.uid() = ANY(participants)
  )
);
