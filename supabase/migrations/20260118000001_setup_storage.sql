-- Create public-media bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-media', 'public-media', true)
ON CONFLICT (id) DO NOTHING;

-- Create private-media bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('private-media', 'private-media', false)
ON CONFLICT (id) DO NOTHING;


-- 1. PUBLIC-MEDIA POLICIES

-- Allow public read access to all files in public-media
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'public-media' AND auth.role() = 'authenticated');
-- Note: If public is true, Supabase handles non-auth select, but RLS still applies if enabled.
-- Actually, for public buckets, usually we allow 'anon' too.
CREATE POLICY "Public Read Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'public-media');

-- Allow users to manage their own folder in public-media
CREATE POLICY "Manage Own Public Media" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'public-media' AND (storage.foldername(name))[1] = 'users' AND (storage.foldername(name))[2] = auth.uid()::text)
  WITH CHECK (bucket_id = 'public-media' AND (storage.foldername(name))[1] = 'users' AND (storage.foldername(name))[2] = auth.uid()::text);


-- 2. PRIVATE-MEDIA POLICIES

-- Owner can manage their own folder in private-media
CREATE POLICY "Manage Own Private Media" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'private-media' AND (storage.foldername(name))[1] = 'users' AND (storage.foldername(name))[2] = auth.uid()::text)
  WITH CHECK (bucket_id = 'private-media' AND (storage.foldername(name))[1] = 'users' AND (storage.foldername(name))[2] = auth.uid()::text);

-- Owner can view their own files in private-media
CREATE POLICY "View Own Private Media" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'private-media' AND (storage.foldername(name))[1] = 'users' AND (storage.foldername(name))[2] = auth.uid()::text);

-- PRO/MAX users can view all private media
CREATE POLICY "Pro/Max View Private Media" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'private-media' AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND stripe_role IN ('PRO', 'MAX')
    )
  );
