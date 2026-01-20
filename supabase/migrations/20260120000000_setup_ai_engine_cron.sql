-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net for making HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a scheduled job to call the ai-engine function every minute
-- Note: Replace 'xatgeifbuawwehlueufq' with your project reference if it changes.
-- The function is called via pg_net's http_post to ensure it's handled asynchronously and reliably.

SELECT cron.schedule(
    'ai-engine-heartbeat',
    '* * * * *',
    $$
    SELECT net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/ai-engine',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
        ),
        body := concat('{"time": "', now(), '"}')::jsonb
    );
    $$
);

-- Note: The 'app.settings.service_role_key' needs to be set in the database configuration
-- Or more commonly in Supabase, you can just use the service role key directly if you are comfortable
-- but using a config variable is cleaner. 
-- Alternatively, if the function has verify_jwt: false, you don't need the Authorization header.
-- For this migration, we assume the function requires authentication.
