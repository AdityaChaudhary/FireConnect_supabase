-- Enable Realtime for Messages Table Only
-- This adds only the messages table to the supabase_realtime publication to save on costs.

DO $$
BEGIN
  -- Create publication if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  -- Add ONLY messages table to the publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- Set Replica Identity to FULL for messages only
ALTER TABLE public.messages REPLICA IDENTITY FULL;
