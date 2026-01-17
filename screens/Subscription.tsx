import React, { useEffect, useState } from 'react';
import Icon from '../components/Icon';
import { getStripeProducts, startStripeCheckout, redirectToCustomerPortal } from '../lib/stripe-utils';
import { useAuth } from '../context/AuthContext';

interface Product {
    id: string;
    name: string;
    description: string;
    price_id: string;
    price_amount: number;
    price_currency: string;
    interval: string;
    metadata: any;
}

const Subscription: React.FC = () => {
    const { user, stripeRole } = useAuth();
    const [plans, setPlans] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        loadPlans();
    }, []);

    const loadPlans = async () => {
        try {
            const data = await getStripeProducts();
            // Sort plans by price (Free < Pro < Max)
            // Assuming metadata or amount can be used. Here using amount.
            const sorted = (data as any[]).sort((a, b) => a.price_amount - b.price_amount);
            setPlans(sorted);
        } catch (err: any) {
            console.error("Failed to load plans:", err);
            setError("Could not load subscription plans.");
        } finally {
            setLoading(false);
        }
    };

    const handleSubscribe = async (plan: Product) => {
        if (!user) return;
        setProcessing(plan.id);
        try {
            await startStripeCheckout(plan.price_id, 'subscription', { planId: plan.name });
        } catch (err) {
            console.error(err);
            alert("Failed to start checkout.");
        } finally {
            setProcessing(null);
        }
    };

    const handleManageSubscription = async () => {
        setProcessing('portal');
        try {
            await redirectToCustomerPortal();
        } catch (err) {
            console.error(err);
        } finally {
            setProcessing(null);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col p-6 overflow-y-auto w-full max-w-6xl mx-auto">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-white mb-2">Upgrade Your Experience</h1>
                <p className="text-white/50">Unlock premium features and get more out of FireConnect.</p>

                {stripeRole && stripeRole !== 'free' && (
                    <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-xl inline-flex items-center gap-3">
                        <Icon name="verified" className="text-primary text-xl" />
                        <span className="text-white">
                            You are currently on the <strong className="text-primary uppercase">{stripeRole}</strong> plan.
                        </span>
                        <button
                            onClick={handleManageSubscription}
                            disabled={!!processing}
                            className="ml-4 text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            {processing === 'portal' ? 'Loading...' : 'Manage Subscription'}
                        </button>
                    </div>
                )}
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 justify-center">
                    <Icon name="error" />
                    <span>{error}</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => {
                    const isCurrentPlan = stripeRole?.toLowerCase() === plan.name.toLowerCase();

                    return (
                        <div
                            key={plan.id}
                            className={`relative bg-surface-dark border p-6 rounded-2xl flex flex-col transition-transform hover:-translate-y-1 ${isCurrentPlan
                                ? 'border-primary/50 shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]'
                                : 'border-white/5 hover:border-white/10'
                                }`}
                        >
                            {isCurrentPlan && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                    Current Plan
                                </div>
                            )}

                            <div className="mb-4">
                                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-bold text-white">
                                        {(plan.price_amount / 100).toLocaleString('en-US', { style: 'currency', currency: plan.price_currency.toUpperCase() })}
                                    </span>
                                    <span className="text-white/40">/{plan.interval}</span>
                                </div>
                            </div>

                            <p className="text-white/60 text-sm mb-6 flex-1 whitespace-pre-line">
                                {plan.description}
                            </p>

                            <button
                                onClick={() => handleSubscribe(plan)}
                                disabled={isCurrentPlan || !!processing}
                                className={`w-full py-3 px-4 rounded-xl font-bold transition-all active:scale-[0.98] ${isCurrentPlan
                                    ? 'bg-white/5 text-white/40 cursor-default'
                                    : 'bg-primary hover:bg-primary-hover text-white shadow-lg'
                                    }`}
                            >
                                {processing === plan.id
                                    ? 'Processing...'
                                    : isCurrentPlan
                                        ? 'Active Plan'
                                        : `Subscribe to ${plan.name}`
                                }
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Subscription;
