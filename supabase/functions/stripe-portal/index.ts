// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js@2.90.1/edge-runtime.d.ts"
import Stripe from "https://esm.sh/stripe@14.14.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const stripe = new Stripe(
    // Try to get from env, fallback to the key found in migrations (for development convenience)
    Deno.env.get("STRIPE_SECRET_KEY") || "",
    {
        apiVersion: "2023-10-16",
        httpClient: Stripe.createFetchHttpClient(),
    }
);

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { returnUrl } = await req.json();

        // Initialize Supabase Client
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        // Get User
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) {
             throw new Error("Unauthorized");
        }

        // Get Stripe Customer ID
        const { data: userProfile, error: profileError } = await supabaseClient
            .from('users')
            .select('stripe_customer_id')
            .eq('id', user.id)
            .single();

        if (!userProfile?.stripe_customer_id) {
            throw new Error("No Stripe Customer found for this user.");
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: userProfile.stripe_customer_id,
            return_url: returnUrl,
        });

        return new Response(
            JSON.stringify({ url: session.url }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            }
        );

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            }
        );
    }
});
