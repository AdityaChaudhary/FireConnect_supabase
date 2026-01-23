-- Enable RLS on spied_profiles
ALTER TABLE public.spied_profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to view records where they are the shadower or the shadowed
CREATE POLICY "Users can view relevant spied profiles" ON public.spied_profiles
FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = target_user_id);

-- Allow users to insert their own records
CREATE POLICY "Users can insert their own spied profiles" ON public.spied_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);
