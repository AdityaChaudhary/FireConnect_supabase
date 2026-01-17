-- Create schemas
create schema if not exists extensions;
create schema if not exists vault;

-- Enable the wrappers extension
create extension if not exists wrappers with schema extensions;

-- Enable the Vault extension
create extension if not exists supabase_vault with schema vault;

-- Create the foreign data wrapper
create foreign data wrapper stripe_wrapper
  handler extensions.stripe_fdw_handler
  validator extensions.stripe_fdw_validator;

-- Create the server (using plain text key to fix db reset issue)
-- Note: In production, we should migrate this to use Vault.
create server stripe_server
  foreign data wrapper stripe_wrapper
  options (
    api_key 'rk_test_51SiYg1GjpIR6M2m6rPKaQ7BjqZBzgdNmMXpJvd9kTu2U7Btnku1z7DIeL3b6PIRVa9RlEc0Z2aUlBvoAaJG7ThN600fKLUfG7v'
  );

-- Create the schema for Stripe foreign tables
create schema if not exists stripe;

-- Create foreign table for Products
-- Ref: https://supabase.com/docs/guides/database/extensions/wrappers/stripe#products
create foreign table stripe.products (
  id text,
  name text,
  active bool,
  default_price text,
  description text,
  created timestamp,
  updated timestamp,
  attrs jsonb
)
server stripe_server
options (
  object 'products',
  rowid_column 'id'
);

-- Create foreign table for Prices
-- Ref: https://supabase.com/docs/guides/database/extensions/wrappers/stripe#prices
create foreign table stripe.prices (
  id text,
  active bool,
  currency text,
  product text,
  unit_amount bigint,
  type text,
  created timestamp,
  attrs jsonb
)
server stripe_server
options (
  object 'prices'
);

-- Create foreign table for Subscriptions
-- Ref: https://supabase.com/docs/guides/database/extensions/wrappers/stripe#subscriptions
create foreign table stripe.subscriptions (
  id text,
  customer text,
  currency text,
  current_period_start timestamp,
  current_period_end timestamp,
  attrs jsonb
)
server stripe_server
options (
  object 'subscriptions',
  rowid_column 'id'
);

-- Create function to get active plans (Restored)
CREATE OR REPLACE FUNCTION public.get_active_plans()
RETURNS TABLE (
  id text,
  name text,
  description text,
  price_id text,
  price_amount bigint,
  price_currency text,
  "interval" text,
  metadata jsonb,
  price_attrs jsonb
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.description,
    pr.id AS price_id,
    pr.unit_amount AS price_amount,
    pr.currency AS price_currency,
    pr.attrs->'recurring'->>'interval' as "interval",
    p.attrs->'metadata' as metadata,
    pr.attrs as price_attrs
  FROM 
    stripe.products p
  JOIN 
    stripe.prices pr ON p.id = pr.product
  WHERE 
    p.active = true 
    AND pr.active = true;
END;
$$;

-- Create function to get comprehensive user subscription details
CREATE OR REPLACE FUNCTION public.get_subscription_info(user_id uuid)
RETURNS TABLE (
    id text,
    status text,
    current_period_end timestamptz,
    cancel_at_period_end boolean,
    role text,
    plan_name text
) SECURITY DEFINER AS $$
DECLARE
    v_stripe_customer_id text;
BEGIN
    -- Get the Stripe Customer ID for the user
    SELECT stripe_customer_id INTO v_stripe_customer_id
    FROM public.users
    WHERE public.users.id = user_id;

    -- If no customer ID found, return empty
    IF v_stripe_customer_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        s.id,
        s.attrs->>'status',
        s.current_period_end AT TIME ZONE 'UTC',
        (s.attrs->>'cancel_at_period_end')::boolean,
        -- COALESCE(p.attrs->'metadata'->>'role', 'FREE'),
        COALESCE(p.attrs->'metadata'->>'firebaseRole', 'FREE'),
        p.name
    FROM stripe.subscriptions s
    JOIN stripe.prices pr ON (s.attrs->'plan'->>'id') = pr.id
    JOIN stripe.products p ON pr.product = p.id
    WHERE s.customer = v_stripe_customer_id
      AND s.attrs->>'status' IN ('active', 'trialing', 'past_due')
    ORDER BY s.current_period_start DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_subscription_info(uuid) TO anon, authenticated, service_role;
