import { supabase } from './supabase.client';
import { PLAN_THEMES, PLAN_DESCRIPTIONS, PLAN_FEATURES } from '../config/plans';

export interface StripeProduct {
    id: string;
    name: string;
    description: string;
    metadata: any;
    price_id: string;
    price_amount: number;
    price_currency: string;
    interval: string;
}

export interface Plan {
    id: string;
    name: string;
    price: string;
    period: string;
    description: string;
    features: { text: string; included: boolean; subtext?: string }[];
    theme: string;
    buttonTheme: string;
    accent: string;
    priceId?: string;
}

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

export const getStripeProducts = async (customSupabase?: any) => {
    const client = customSupabase || supabase;
    return fetchWithRetry<StripeProduct[]>(async () => await client.rpc('get_active_plans'));
};

export const mapProductToPlan = (product: StripeProduct): Plan => {
    const metadata = product.metadata || {};
    const roleFromMetadata = (metadata.role as string || '').toUpperCase();
    const roleFromName = product.name.toUpperCase();

    let themeKey: keyof typeof PLAN_THEMES = 'PRO';
    if (roleFromMetadata.includes('MAX') || roleFromName.includes('MAX') || roleFromName.includes('ULTIMATE')) themeKey = 'MAX';
    else if (roleFromMetadata.includes('PRO') || roleFromName.includes('PRO')) themeKey = 'PRO';
    else if (roleFromMetadata.includes('FREE') || roleFromMetadata.includes('LITE') || roleFromName.includes('FREE') || roleFromName.includes('LITE')) themeKey = 'FREE';

    const role = themeKey;
    const theme = PLAN_THEMES[themeKey as keyof typeof PLAN_THEMES] || PLAN_THEMES.PRO;

    const formattedPrice = product.price_amount
        ? (product.price_amount / 100).toLocaleString('en-US', {
            style: 'currency',
            currency: product.price_currency?.toUpperCase() || 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        })
        : '$0';

    const period = product.interval ? `/ ${product.interval === 'month' ? 'mo' : product.interval}` : '';

    let features = PLAN_FEATURES[role as keyof typeof PLAN_FEATURES] || [{ text: 'Included Feature', included: true }];
    if (metadata.features) {
        const featuresList = (metadata.features as string).split(',').filter(f => f.trim().length > 0);
        features = featuresList.map(f => ({
            text: f.trim(),
            included: true
        }));
    }

    return {
        id: role,
        name: product.name,
        price: formattedPrice,
        period: period,
        description: product.description || PLAN_DESCRIPTIONS[role] || '',
        features: features,
        ...theme,
        priceId: product.price_id
    };
};


export const processRawStripeProducts = (stripeProducts: StripeProduct[]): Plan[] => {
    if (!stripeProducts) return [];

    const validProducts = stripeProducts.filter(p => {
        const name = p.name.toUpperCase();
        return !name.includes('CREDIT') && !name.includes('SPY');
    });

    const mappedPlans = validProducts.map(mapProductToPlan);

    const roleOrder = { FREE: 0, PRO: 1, MAX: 2 };
    mappedPlans.sort((a, b) => {
        const rA = roleOrder[a.id as keyof typeof roleOrder] ?? 1;
        const rB = roleOrder[b.id as keyof typeof roleOrder] ?? 1;
        return rA - rB;
    });

    // Ensure FREE plan is always present
    if (!mappedPlans.find(p => p.id === 'FREE')) {
        mappedPlans.unshift({
            id: 'FREE',
            name: 'LITE',
            price: '$0',
            period: '/ mo',
            description: PLAN_DESCRIPTIONS.FREE,
            features: PLAN_FEATURES.FREE,
            ...PLAN_THEMES.FREE
        });
    }

    const uniquePlans: Plan[] = [];
    const seen = new Set();
    mappedPlans.forEach(p => {
        if (!seen.has(p.id)) {
            uniquePlans.push(p);
            seen.add(p.id);
        }
    });

    return uniquePlans;
};

export const getProcessedStripeProducts = async (customSupabase?: any): Promise<Plan[]> => {
    try {
        const stripeProducts = await getStripeProducts(customSupabase);
        return processRawStripeProducts(stripeProducts || []);
    } catch (err) {
        console.error("Failed to fetch or process plans:", err);
        return [{
            id: 'FREE',
            name: 'LITE',
            price: '$0',
            period: '/ mo',
            description: PLAN_DESCRIPTIONS.FREE,
            features: PLAN_FEATURES.FREE,
            ...PLAN_THEMES.FREE
        }];
    }
};


export const startStripeCheckout = async (priceId: string, mode: 'payment' | 'subscription' = 'subscription', options?: { planId?: string, credits?: number, oldBalance?: number }) => {
    let successPath = '/';
    console.log('Starting checkout for priceId: ', priceId);

    if (mode === 'subscription') {
        successPath = `/welcome?plan=${options?.planId || 'PRO'}&session_id={CHECKOUT_SESSION_ID}`;
    } else {
        successPath = `/credits-welcome?credits=${options?.credits || 0}&oldBalance=${options?.oldBalance || 0}&session_id={CHECKOUT_SESSION_ID}`;
    }

    // Call Edge Function to create checkout session
    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
            priceId,
            mode,
            successUrl: window.location.origin + successPath,
            cancelUrl: window.location.origin + "/subscription",
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
