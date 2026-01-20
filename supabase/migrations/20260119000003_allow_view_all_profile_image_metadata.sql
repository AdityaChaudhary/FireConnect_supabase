-- Migration to allow everyone to see profile image metadata
-- This enables showing blurred previews for private images to all users

-- First, drop the old restrictive policy
DROP POLICY IF EXISTS "Anyone can view public profile images" ON public.profile_images;

-- Create a new policy that allows anyone to view any profile image record
-- The actual media files are still protected by storage RLS policies
CREATE POLICY "Anyone can view all profile images" ON public.profile_images 
  FOR SELECT USING (true);
