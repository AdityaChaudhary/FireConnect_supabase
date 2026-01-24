-- Migration: Fix AI Engine Cron Crash
-- Date: 2026-01-24
-- Description: Wraps the AI Engine http call in a function with a 60s timeout to prevent pg_net crashes due to timeout mismatches.

-- 1. Create a wrapper function to safely invoke the edge function with explicit timeout
CREATE OR REPLACE FUNCTION public.trigger_ai_engine()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- ai-engine runs for ~40s. Default pg_net timeout is 5s. 
    -- We increase it to 60s to prevent premature timeout and potential worker crashes.
    PERFORM net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/ai-engine',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
        ),
        body := jsonb_build_object('time', now()),
        timeout_milliseconds := 60000 
    );
END;
$$;

-- 2. Schedule the job to use the new wrapper
-- cron.schedule upserts if the name matches, so no need to explicit unschedule which might error if missing.
SELECT cron.schedule('ai-engine-heartbeat', '*/2 * * * *', 'SELECT public.trigger_ai_engine()');
