-- Migration for Random Chat feature

-- 1. Create Tables

-- Random Chat Pool: active users looking for a match
CREATE TABLE public.random_chat_pool (
  user_id UUID REFERENCES public.users NOT NULL PRIMARY KEY,
  status TEXT DEFAULT 'SEARCHING' CHECK (status IN ('SEARCHING', 'MATCHED')),
  matched_with UUID REFERENCES public.users,
  gender_filter TEXT, -- 'MALE', 'FEMALE', or NULL for 'ANY'
  location_filter TEXT, -- e.g., 'IN' (Country code) or NULL for 'GLOBAL'
  last_ping_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages Random: messages for random chats
CREATE TABLE public.messages_random (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES public.users NOT NULL,
  receiver_id UUID REFERENCES public.users NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Random Chat Skips: keep track of who skipped who for cool-down
CREATE TABLE public.random_chat_skips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users NOT NULL,
  skipped_user_id UUID REFERENCES public.users NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, skipped_user_id)
);

-- 2. Enable RLS
ALTER TABLE public.random_chat_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages_random ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.random_chat_skips ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Random Chat Pool
CREATE POLICY "Users can view their own pool status" ON public.random_chat_pool
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = matched_with);

CREATE POLICY "Users can manage their own pool status" ON public.random_chat_pool
  FOR ALL USING (auth.uid() = user_id);

-- Messages Random
CREATE POLICY "Users can view messages they sent or received" ON public.messages_random
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages to their match" ON public.messages_random
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.random_chat_pool
      WHERE (user_id = auth.uid() AND matched_with = receiver_id AND status = 'MATCHED')
      OR (user_id = receiver_id AND matched_with = auth.uid() AND status = 'MATCHED')
    )
  );

-- 4. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.random_chat_pool;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages_random;

-- 5. Cleanup Function (to be called by edge function or pg_cron)
CREATE OR REPLACE FUNCTION public.cleanup_random_chat_pool()
RETURNS VOID AS $$
BEGIN
  -- 1. Mark users who haven't pinged in 45 seconds as unmatched and remove them
  UPDATE public.random_chat_pool
  SET status = 'SEARCHING', matched_with = NULL
  WHERE matched_with IN (
    SELECT user_id FROM public.random_chat_pool 
    WHERE last_ping_at < NOW() - INTERVAL '45 seconds'
  );

  -- 2. Delete the inactive ones
  DELETE FROM public.random_chat_pool
  WHERE last_ping_at < NOW() - INTERVAL '45 seconds';

  -- 3. Delete old skip records (older than 10 minutes)
  DELETE FROM public.random_chat_skips
  WHERE created_at < NOW() - INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Atomic Matching Function
-- Drop the old version first to ensure we don't have overloaded functions with the same name
DROP FUNCTION IF EXISTS public.match_random_user(UUID);

CREATE OR REPLACE FUNCTION public.match_random_user(
  current_user_id UUID, 
  exclude_user_id UUID DEFAULT NULL,
  filters JSON DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  match_id UUID;
  old_match_id UUID;
  result JSON;
  req_gender TEXT;
  req_location TEXT;
BEGIN
  -- Extract filters
  req_gender := filters->>'gender';
  req_location := filters->>'location';

  -- 0. Handle existing match if any (cleanup the former partner)
  SELECT matched_with INTO old_match_id
  FROM public.random_chat_pool
  WHERE user_id = current_user_id;

  IF old_match_id IS NOT NULL THEN
    UPDATE public.random_chat_pool
    SET status = 'SEARCHING', matched_with = NULL
    WHERE user_id = old_match_id;
  END IF;

  -- 1. Try to find a waiting user
  -- Exclude: ourselves, the specifically excluded user (current session), 
  -- and anyone who has skipped us or we have skipped in the last 10m
  -- Filtering logic:
  -- - Match user's gender if req_gender is set
  -- - Match user's location if req_location is set
  SELECT p.user_id INTO match_id
  FROM public.random_chat_pool p
  JOIN public.users u ON p.user_id = u.id
  WHERE p.status = 'SEARCHING'
    AND p.user_id != current_user_id
    AND (exclude_user_id IS NULL OR p.user_id != exclude_user_id)
    AND (req_gender IS NULL OR u.gender = req_gender)
    AND (req_location IS NULL OR u.location = req_location)
    AND NOT EXISTS (
      SELECT 1 FROM public.random_chat_skips s
      WHERE (s.user_id = current_user_id AND s.skipped_user_id = p.user_id)
      OR (s.user_id = p.user_id AND s.skipped_user_id = current_user_id)
    )
  LIMIT 1
  FOR UPDATE SKIP LOCKED; -- Lock the row to prevent race conditions

  IF match_id IS NOT NULL THEN
    -- Match found!
    INSERT INTO public.random_chat_pool (user_id, status, last_ping_at, matched_with, gender_filter, location_filter)
    VALUES (current_user_id, 'MATCHED', NOW(), match_id, req_gender, req_location)
    ON CONFLICT (user_id) DO UPDATE
    SET status = 'MATCHED', matched_with = match_id, last_ping_at = NOW(), gender_filter = req_gender, location_filter = req_location;

    UPDATE public.random_chat_pool
    SET status = 'MATCHED', matched_with = current_user_id, last_ping_at = NOW()
    WHERE user_id = match_id;

    result := json_build_object('status', 'MATCHED', 'matched_with', match_id);
  ELSE
    -- No match found, join pool as searching
    INSERT INTO public.random_chat_pool (user_id, status, last_ping_at, matched_with, gender_filter, location_filter)
    VALUES (current_user_id, 'SEARCHING', NOW(), NULL, req_gender, req_location)
    ON CONFLICT (user_id) DO UPDATE
    SET status = 'SEARCHING', matched_with = NULL, last_ping_at = NOW(), gender_filter = req_gender, location_filter = req_location;

    result := json_build_object('status', 'SEARCHING');
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
