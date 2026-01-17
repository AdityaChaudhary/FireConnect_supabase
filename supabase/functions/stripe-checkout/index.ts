// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import Stripe from "https://esm.sh/stripe@14.14.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const stripe = new Stripe(
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
        const { priceId, mode, successUrl, cancelUrl } = await req.json();

        if (!priceId) {
            throw new Error("Missing priceId");
        }

        // Initialize Supabase Client
        const authHeader = req.headers.get('Authorization');
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            authHeader ? { global: { headers: { Authorization: authHeader } } } : {}
        );

        // Get User from Auth Header manually to be robust
        const token = authHeader?.replace('Bearer ', '');
        let user = null;

        if (token) {
            const { data, error } = await supabaseClient.auth.getUser(token);
            if (!error && data?.user) {
                user = data.user;
            } else {
                console.warn("Auth check failed:", error);
            }
        }

        if (!user) {
             console.warn("Proceeding as guest checkout (no valid auth session found)");
             // Optional: throw error if authentication is mandatory
             // throw new Error("Unauthorized");
        }

        let customerId = undefined;
        if (user) {
            const { data: userProfile, error: profileError } = await supabaseClient
                .from('users')
                .select('stripe_customer_id')
                .eq('id', user.id)
                .single();

            if (userProfile?.stripe_customer_id) {
                customerId = userProfile.stripe_customer_id;
            }
        }

        const sessionConfig: any = {
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: mode || "subscription",
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                user_id: user?.id,
            },
            subscription_data: mode === 'subscription' ? {
                metadata: {
                    user_id: user?.id
                }
            } : undefined,
        };

        if (customerId) {
            sessionConfig.customer = customerId;
        } else {
            sessionConfig.customer_email = user?.email;
        }

        const session = await stripe.checkout.sessions.create(sessionConfig);

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
