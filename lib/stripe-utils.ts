import { supabase } from './supabase';

export const getStripeProducts = async () => {
    const { data, error } = await supabase.rpc('get_active_plans');
    if (error) throw error;
    return data;
};

export const startStripeCheckout = async (priceId: string, mode: 'payment' | 'subscription' = 'subscription', options?: { planId?: string, credits?: number, oldBalance?: number }) => {
    let successPath = '/';
    console.log('Starting checkout for priceId: ', priceId);

    if (mode === 'subscription') {
        successPath = `/#/welcome?plan=${options?.planId || 'PRO'}&session_id={CHECKOUT_SESSION_ID}`;
    } else {
        successPath = `/#/credits-welcome?credits=${options?.credits || 0}&oldBalance=${options?.oldBalance || 0}&session_id={CHECKOUT_SESSION_ID}`;
    }

    // Call Edge Function to create checkout session
    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
            priceId,
            mode,
            successUrl: window.location.origin + successPath,
            cancelUrl: window.location.origin + "/#/subscription",
        }
    });

    if (error || !data?.url) {
        console.error("Error creating checkout session:", error);
        alert("Failed to start checkout. Check console for details.");
        return;
    }

    window.location.assign(data.url);
};

export const redirectToCustomerPortal = async () => {
    const { data, error } = await supabase.functions.invoke('stripe-portal', {
        body: {
            returnUrl: window.location.origin + "/subscription"
        }
    });

    if (error || !data?.url) {
        console.error("Error creating portal session:", error);
        alert("Failed to redirect to portal.");
        return;
    }

    window.location.assign(data.url);
};
