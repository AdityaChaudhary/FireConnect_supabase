import Stripe from "https://esm.sh/stripe@14.14.0";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Helper to add spy credits to a user
 */
export async function handleAddSpyCredits(
    supabaseClient: SupabaseClient,
    stripe: Stripe,
    object: Stripe.Subscription | Stripe.Checkout.Session,
    type: 'subscription' | 'session'
) {
    const customerId = object.customer as string;
    let userId = object.metadata?.user_id || object.metadata?.firebase_uid;

    console.log(`Processing ${type} for customer: ${customerId}, userId: ${userId}`);

    // 1. Try to find user via stripe_customer_id if userId is missing
    if (!userId && customerId) {
        const { data, error } = await supabaseClient
            .from('users')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single();
        
        if (data) {
            userId = data.id;
        } else if (error) {
            console.warn(`Could not find user for customerId: ${customerId}`, error.message);
        }
    }

    if (!userId) {
        console.error(`No user found for ${type} (customer: ${customerId})`);
        return;
    }

    // 2. Determine credits to add
    let creditsToAdd = 0;
    if (object.metadata?.spyCredits) {
        creditsToAdd = parseInt(object.metadata.spyCredits, 10);
    }

    // 3. One-time payment fallback logic from original codebase
    if (!creditsToAdd && type === 'session') {
        const session = object as Stripe.Checkout.Session;
        try {
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
            if (lineItems.data.length > 0) {
                const firstItem = lineItems.data[0];
                const price = firstItem.price;

                if (price?.transform_quantity?.divide_by) {
                    creditsToAdd = price.transform_quantity.divide_by * (firstItem.quantity || 1);
                    console.log(`Calculated ${creditsToAdd} credits from price transform_quantity`);
                }
            }
        } catch (err) {
            console.warn('Failed to fetch line items or calculate credits from price', err);
        }
    }

    // 4. Default fallback
    if (!creditsToAdd || isNaN(creditsToAdd)) {
        creditsToAdd = 20;
        console.log(`Using default fallback of ${creditsToAdd} credits`);
    }

    console.log(`Adding ${creditsToAdd} credits to user ${userId}`);

    // 5. Determine the role from the product metadata (if applicable)
    let newRole: string | undefined;
    try {
        let productId: string | undefined;
        if (type === 'subscription') {
            const sub = object as Stripe.Subscription;
            productId = sub.items.data[0].plan?.product as string || sub.items.data[0].price?.product as string;
        } else {
            const session = object as Stripe.Checkout.Session;
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
            if (lineItems.data.length > 0) {
                productId = lineItems.data[0].price?.product as string;
            }
        }

        if (productId) {
            const product = await stripe.products.retrieve(productId);
            // Use firebaseRole (migration-standard) or role metadata
            newRole = (product.metadata?.firebaseRole || product.metadata?.role)?.toUpperCase();
            if (newRole && !['FREE', 'PRO', 'MAX'].includes(newRole)) {
                console.warn(`Unexpected role from metadata: ${newRole}, ignoring.`);
                newRole = undefined;
            }
        }
    } catch (err) {
        console.warn('Failed to determine role from Stripe product metadata', err);
    }

    // 6. Update user in database
    // Fetch current credits
    const { data: userData, error: fetchError } = await supabaseClient
        .from('users')
        .select('spy_credits, stripe_role')
        .eq('id', userId)
        .single();
    
    if (fetchError) {
        console.error('Error fetching current user data:', fetchError);
        return;
    }

    const currentCredits = userData.spy_credits || 0;
    const updatePayload: Record<string, unknown> = {
        spy_credits: currentCredits + creditsToAdd,
        updated_at: new Date().toISOString()
    };

    if (newRole) {
        console.log(`Setting stripe_role to ${newRole} for user ${userId}`);
        updatePayload.stripe_role = newRole;
    }

    const { error: updateError } = await supabaseClient
        .from('users')
        .update(updatePayload)
        .eq('id', userId);

    if (updateError) {
        console.error('Error updating user data:', updateError);
    } else {
        console.log(`Successfully updated user data for ${userId}: credits=${updatePayload.spy_credits}${newRole ? `, role=${newRole}` : ''}`);
    }
}

/**
 * Helper to reset role when subscription is deleted
 */
export async function handleSubscriptionDeleted(
    supabaseClient: SupabaseClient,
    subscription: Stripe.Subscription
) {
    const customerId = subscription.customer as string;
    
    // Find user by customer ID
    const { data: userData, error: fetchError } = await supabaseClient
        .from('users')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();
    
    if (fetchError || !userData) {
        console.warn(`Could not find user for deleted subscription (customer: ${customerId})`);
        return;
    }

    console.log(`Resetting stripe_role to FREE for user ${userData.id} due to subscription deletion`);
    
    const { error: updateError } = await supabaseClient
        .from('users')
        .update({ 
            stripe_role: 'FREE',
            updated_at: new Date().toISOString()
        })
        .eq('id', userData.id);

    if (updateError) {
        console.error('Error resetting role:', updateError);
    } else {
        console.log(`Successfully reset role for user ${userData.id}`);
    }
}
