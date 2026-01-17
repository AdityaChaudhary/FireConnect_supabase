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
        const body = await req.json();
        console.log("Received request body:", body);

        const {
            returnUrl,
            locale = 'auto',
            configuration,
            flow_data
        } = body;

        if (!returnUrl) {
            console.error("Missing returnUrl in request body");
            throw new Error("Missing returnUrl");
        }

        // Initialize Supabase Client
        const authHeader = req.headers.get('Authorization');
        console.log("Auth header present:", !!authHeader);

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader! } } }
        );

        // Get User from Auth Header manually to be robust
        const token = authHeader?.replace('Bearer ', '');
        console.log("Extracting token for manual auth check...");

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
        
        if (authError || !user) {
             console.error("Authentication failed or user not found:", authError);
             throw new Error("Unauthorized");
        }
        console.log("Authenticated user ID:", user.id);

        // Get Stripe Customer ID
        const { data: userProfile, error: profileError } = await supabaseClient
            .from('users')
            .select('stripe_customer_id')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error("Error fetching user profile:", profileError);
            throw new Error("Failed to fetch user profile");
        }

        if (!userProfile?.stripe_customer_id) {
            console.error("Stripe Customer ID not found for user:", user.id);
            throw new Error("No Stripe Customer found for this user.");
        }
        console.log("Found Stripe Customer ID:", userProfile.stripe_customer_id);

        const params: any = {
            customer: userProfile.stripe_customer_id,
            return_url: returnUrl,
            locale: locale,
        };

        if (configuration) {
            params.configuration = configuration;
        }
        if (flow_data) {
            params.flow_data = flow_data;
        }

        console.log("Creating portal session with params:", params);
        const session = await stripe.billingPortal.sessions.create(params);
        console.log("Portal session created successfully:", session.id);

        return new Response(
            JSON.stringify({ url: session.url }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            }
        );

    } catch (error: any) {
        console.error("Error creating portal session:", error.message, error.stack);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            }
        );
    }
});
