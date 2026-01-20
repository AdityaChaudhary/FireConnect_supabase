-- Add unique constraint to profile_images to support upsert operations
ALTER TABLE public.profile_images 
ADD CONSTRAINT profile_images_user_id_url_key UNIQUE (user_id, url);
