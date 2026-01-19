import { supabase } from './supabase';

export const fetchWithRetry = async <T>(
    operation: () => Promise<{ data: T | null; error: any }>,
    maxRetries = 3,
    delay = 1000
): Promise<T | null> => {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const { data, error } = await operation();
            if (!error) return data;

            // If error is likely temporary (connection, recovery), we retry
            // PGRST000 = Recovery mode, PGRST001 = Connection refused
            const isRetryable = error?.code?.startsWith('PGRST') || error?.message?.includes('fetch') || error?.status >= 500;

            if (!isRetryable) throw error; // Don't retry auth errors, etc.

            lastError = error;
            console.warn(`Attempt ${i + 1} failed, retrying in ${delay}ms...`, error);
            await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i))); // Exponential backoff
        } catch (err) {
            // Network errors (fetch failed) often end up here
            lastError = err;
            console.warn(`Attempt ${i + 1} threw error, retrying...`, err);
            await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
    }
    throw lastError;
};

export const getStripeProducts = async () => {
    return fetchWithRetry(async () => await supabase.rpc('get_active_plans'));
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
