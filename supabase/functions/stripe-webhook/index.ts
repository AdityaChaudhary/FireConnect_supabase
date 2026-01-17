// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import Stripe from "https://esm.sh/stripe@14.14.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { handleAddSpyCredits } from "./credits.ts";

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

    console.log(`Received Stripe event: ${event.type} (${event.id})`);

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const userId = session.metadata?.user_id;
                const customerId = session.customer as string;

                // Sync customer ID if available
                if (userId && customerId) {
                    const { error } = await supabaseClient
                        .from('users')
                        .update({ stripe_customer_id: customerId })
                        .eq('id', userId);
                    
                    if (error) console.error('Error syncing customer ID:', error);
                    else console.log(`Synced customer ID ${customerId} for user ${userId}`);
                }

                // Handle one-time purchases
                if (session.mode === 'payment' && session.payment_status === 'paid') {
                    await handleAddSpyCredits(supabaseClient, stripe, session, 'session');
                }
                break;
            }

            case 'customer.subscription.created': {
                const subscription = event.data.object as Stripe.Subscription;
                if (subscription.status === 'active') {
                    console.log('Adding credits for new active subscription');
                    await handleAddSpyCredits(supabaseClient, stripe, subscription, 'subscription');
                }
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                const previousAttributes = (event.data as any).previous_attributes;

                let shouldAddCredits = false;

                // 1. Activation from incomplete
                if (previousAttributes?.status === 'incomplete' && subscription.status === 'active') {
                    shouldAddCredits = true;
                    console.log('Adding credits for subscription activation (incomplete -> active)');
                }
                // 2. Upgrade (Price change/items changed)
                else if (previousAttributes?.items) {
                    shouldAddCredits = true;
                    console.log('Adding credits for subscription upgrade (items changed)');
                }
                // 3. Activation from trialing
                else if (previousAttributes?.status === 'trialing' && subscription.status === 'active') {
                    shouldAddCredits = true;
                    console.log('Adding credits for subscription activation (trialing -> active)');
                }

                if (shouldAddCredits) {
                    await handleAddSpyCredits(supabaseClient, stripe, subscription, 'subscription');
                }
                break;
            }

            default:
                console.log(`Event type ${event.type} not explicitly handled for credits.`);
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { "Content-Type": "application/json" },
        });

    } catch (err: any) {
        console.error('Error processing event:', err.message);
        return new Response(`Error processing event: ${err.message}`, { status: 500 });
    }
});


