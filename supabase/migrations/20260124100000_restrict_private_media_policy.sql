-- Drop the old overly-permissive policy
DROP POLICY IF EXISTS "Pro/Max View Private Media" ON storage.objects;

-- Create the new restricted policy
-- This policy allows Pro/Max users to view private media ONLY if they have un-blurred (spied) it.
CREATE POLICY "Pro/Max View Private Media" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'private-media' AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND stripe_role IN ('PRO', 'MAX')
    ) AND
    EXISTS (
      SELECT 1 FROM public.spied_profiles
      WHERE user_id = auth.uid()
      AND target_user_id = (storage.foldername(name))[2]::uuid
    )
  );
