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

    // 5. Update spy credits in database
    // Fetch current credits
    const { data: userData, error: fetchError } = await supabaseClient
        .from('users')
        .select('spy_credits')
        .eq('id', userId)
        .single();
    
    if (fetchError) {
        console.error('Error fetching current credits:', fetchError);
        return;
    }

    const currentCredits = userData.spy_credits || 0;
    const newCredits = currentCredits + creditsToAdd;

    const { error: updateError } = await supabaseClient
        .from('users')
        .update({ spy_credits: newCredits })
        .eq('id', userId);

    if (updateError) {
        console.error('Error updating credits:', updateError);
    } else {
        console.log(`Successfully updated spy credits for user ${userId} to ${newCredits}`);
    }
}
