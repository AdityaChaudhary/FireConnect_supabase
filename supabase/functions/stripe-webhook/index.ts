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
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' 
);

Deno.serve(async (req) => {
    const signature = req.headers.get("Stripe-Signature");
    
    if (!signature) {
        return new Response("Missing Stripe-Signature", { status: 400 });
    }

    const body = await req.text();
    let event;

    try {
        event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
            undefined,
            cryptoProvider
        );
    } catch (err: any) {
        console.error('Webhook Error:', err.message);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            const userId = session.metadata?.user_id;
            const customerId = session.customer as string;

            console.log(`Received checkout.session.completed for user ${userId} with customer ${customerId}`);

            if (userId && customerId) {
                const { error } = await supabaseClient
                    .from('users')
                    .update({ stripe_customer_id: customerId })
                    .eq('id', userId);
                
                if (error) {
                    console.error('Error updating user:', error);
                    throw error;
                }
                console.log(`Updated user ${userId} with customer ${customerId}`);
            }else{
                console.error('Missing user_id or customer_id', userId, customerId);

            }
        
        
        return new Response(JSON.stringify({ received: true }), {
            headers: { "Content-Type": "application/json" },
        });

        }
        else{
            // return 501 not implemented
            console.log(`Event type ${event.type} not implemented. Returning 501`);
            return new Response(`Event type ${event.type} not implemented`, { status: 501 });
        }

    } catch (err: any) {
        return new Response(`Error processing event: ${err.message}`, { status: 500 });
    }
});
