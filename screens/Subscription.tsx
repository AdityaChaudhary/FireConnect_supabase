import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { getStripeProducts, startStripeCheckout, redirectToCustomerPortal } from '../lib/stripe-utils';
import { PLAN_THEMES, PLAN_DESCRIPTIONS, PLAN_FEATURES } from '../config/plans';

interface Plan {
    id: string;
    name: string;
    price: string;
    period: string;
    description: string;
    features: { text: string; included: boolean; subtext?: string }[];
    theme: string;
    buttonTheme: string;
    accent: string;
    // Store original product/price IDs for checkout
    priceId?: string;
}


interface StripeProduct {
    id: string;
    name: string;
    description: string;
    metadata: any;
    price_id: string;
    price_amount: number;
    price_currency: string;
    interval: string;
}

const Subscription: React.FC = () => {
    const { stripeRole, refreshProfile } = useAuth();
    const navigate = useNavigate();
    const [updating, setUpdating] = useState(false);
    const [portalLoading, setPortalLoading] = useState(false);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const mapProductToPlan = (product: StripeProduct): Plan => {
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
            id: role, // This serves as the Plan ID (FREE, PRO, MAX)
            name: product.name,
            price: formattedPrice,
            period: period,
            description: product.description || PLAN_DESCRIPTIONS[role] || '',
            features: features,
            ...theme,
            priceId: product.price_id
        };
    };

    const fetchPlans = async () => {
        setLoadingProducts(true);
        setError(null);
        try {
            const data = await getStripeProducts();
            // Filter out non-subscription products or "Spy Credits" if they appear here
            // Also ensure we only get unique plans per role if multiple exist (priority ?)
            // For now, map all and then dedup based on role logic

            // Check if data is null or undefined which might happen if retry failed ultimately
            if (!data) throw new Error("No data received from payment service");

            const validProducts = (data as StripeProduct[]).filter(p => {
                const name = p.name.toUpperCase();
                return !name.includes('CREDIT') && !name.includes('SPY');
            });

            if (validProducts.length > 0) {
                const mappedPlans = validProducts.map(mapProductToPlan);

                // If we have duplicates for a role (e.g. multiple PRO plans), we might need to pick one.
                // Assuming backend returns active ones.

                // Sort to ensure FREE < PRO < MAX order
                const roleOrder = { FREE: 0, PRO: 1, MAX: 2 };
                mappedPlans.sort((a, b) => {
                    const rA = roleOrder[a.id as keyof typeof roleOrder] ?? 1;
                    const rB = roleOrder[b.id as keyof typeof roleOrder] ?? 1;
                    return rA - rB;
                });

                // Ensure we have a FREE plan visual even if not in Stripe (or if purely DB based)
                // Source code manually adds FREE if list is empty? Source logic:
                // plans = stripeProducts.length > 0 ? mapped... : [Default FREE]
                // We should probably allow mixing.

                // Check if FREE exists
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

                // Remove duplicates, keeping the one appearing last (or first? usually first is best if sorted)
                // Actually let's just keep unique IDs
                const uniquePlans: Plan[] = [];
                const seen = new Set();
                mappedPlans.forEach(p => {
                    if (!seen.has(p.id)) {
                        uniquePlans.push(p);
                        seen.add(p.id);
                    }
                });

                setPlans(uniquePlans);
            } else {
                // Fallback if no products found
                setPlans([{
                    id: 'FREE',
                    name: 'LITE',
                    price: '$0',
                    period: '/ mo',
                    description: PLAN_DESCRIPTIONS.FREE,
                    features: PLAN_FEATURES.FREE,
                    ...PLAN_THEMES.FREE
                }]);
            }

        } catch (err: any) {
            console.error("Failed to load plans:", err);
            setError(err.message || "Failed to load subscription plans. Please try again.");
        } finally {
            setLoadingProducts(false);
        }
    };

    useEffect(() => {
        fetchPlans();
    }, []);


    const currentSubscriptionLevel = stripeRole ? stripeRole.toUpperCase() : 'FREE';
    const currentPlanId = currentSubscriptionLevel;

    const [activePlanIndex, setActivePlanIndex] = useState(0);

    // Update active plan index when plans or role changes
    useEffect(() => {
        if (plans.length > 0) {
            const index = plans.findIndex(p => p.id === currentPlanId);
            if (index !== -1) setActivePlanIndex(index);
        }
    }, [plans.length, currentPlanId]);

    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;
        if (isLeftSwipe) {
            setActivePlanIndex(prev => (prev + 1) % plans.length);
        } else if (isRightSwipe) {
            setActivePlanIndex(prev => (prev - 1 + plans.length) % plans.length);
        }
    };

    const nextPlan = () => setActivePlanIndex(prev => (prev + 1) % plans.length);
    const prevPlan = () => setActivePlanIndex(prev => (prev - 1 + plans.length) % plans.length);

    const handleSubscribe = async (plan: Plan) => {
        if (plan.id === currentPlanId) return;

        if (plan.id === 'FREE' || plan.price === '$0') {
            setUpdating(true);
            try {
                await refreshProfile();
                navigate('/profile');
            } catch (error) {
                console.error("Error updating subscription:", error);
                alert("Failed to update subscription.");
            } finally {
                setUpdating(false);
            }
            return;
        }

        if (!plan.priceId) {
            alert("This plan is currently unavailable.");
            return;
        }

        setUpdating(true);
        try {
            await startStripeCheckout(plan.priceId, 'subscription', { planId: plan.id });
        } catch (error) {
            console.error("Error starting checkout:", error);
            alert("Could not initiate checkout. Please check your connection.");
            setUpdating(false);
        }
    };

    const handleManageSubscription = async () => {
        setPortalLoading(true);
        try {
            await redirectToCustomerPortal();
        } catch (error) {
            console.error("Error redirecting to customer portal:", error);
            alert("Failed to open subscription management. Please try again later.");
        } finally {
            setPortalLoading(false);
        }
    };

    if (loadingProducts) {
        return (
            <div className="flex-1 flex items-center justify-center p-6 bg-background-dark min-h-screen">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background-dark min-h-screen gap-4">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-2">
                    <Icon name="error_outline" className="text-3xl text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white">Connection Error</h3>
                <p className="text-white/60 text-center max-w-xs">{error}</p>
                <button
                    onClick={fetchPlans}
                    className="mt-4 px-8 py-3 bg-white/10 hover:bg-white/20 rounded-full text-white font-semibold transition-all active:scale-95"
                >
                    Retry Connection
                </button>
            </div>
        );
    }

    if (plans.length === 0) return null;

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-background-dark text-white pb-10">
            {/* Header */}
            <header className="sticky top-0 z-20 flex w-full items-center justify-between px-4 py-8">
                <div className="w-10"></div> {/* Placeholder for symmetry */}
                <h1 className="text-white text-lg font-bold">My Subscription</h1>
                <button
                    onClick={() => {
                        if (window.history.length <= 1 || (window.history.state && window.history.state.idx === 0)) {
                            navigate('/profile');
                        } else {
                            navigate(-1);
                        }
                    }}
                    className="flex h-10 w-10 items-center justify-end text-white/80 hover:text-white active:scale-95 transition-all"
                >
                    <Icon name="close" className="text-3xl" />
                </button>
            </header>

            <main className="flex-1 flex flex-col items-center px-4 w-full max-w-md mx-auto">
                {/* Plan Carousel / Selector */}
                <div className="w-full flex flex-col gap-8 mt-2 relative">
                    {/* Desktop Arrows */}
                    <button
                        onClick={prevPlan}
                        className="hidden lg:flex absolute left-[-100px] top-1/2 -translate-y-1/2 w-16 h-16 items-center justify-center rounded-full bg-white/5 border border-white/10 backdrop-blur-xl hover:bg-white/10 transition-all active:scale-90 group z-10"
                        aria-label="Previous Plan"
                    >
                        <Icon name="chevron_left" className="text-4xl text-white/50 group-hover:text-white transition-colors" />
                    </button>
                    <button
                        onClick={nextPlan}
                        className="hidden lg:flex absolute right-[-100px] top-1/2 -translate-y-1/2 w-16 h-16 items-center justify-center rounded-full bg-white/5 border border-white/10 backdrop-blur-xl hover:bg-white/10 transition-all active:scale-90 group z-10"
                        aria-label="Next Plan"
                    >
                        <Icon name="chevron_right" className="text-4xl text-white/50 group-hover:text-white transition-colors" />
                    </button>

                    <div
                        className={`relative w-full rounded-[40px] p-8 border transition-all duration-500 shadow-2xl ${plans[activePlanIndex].theme}`}
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                    >
                        <div className="flex flex-col items-center gap-4 mb-6 pt-4">
                            <div className="flex items-center gap-3">
                                <Icon name="local_fire_department" className={`text-4xl ${plans[activePlanIndex].accent}`} filled />
                                <h2 className="text-4xl font-black italic tracking-tighter uppercase">
                                    {plans[activePlanIndex].name}
                                </h2>
                            </div>
                        </div>

                        <div className="w-full h-px bg-white/10 mb-8"></div>

                        <div className="flex flex-col gap-8">
                            <div className="flex items-center justify-center gap-3 mb-2">
                                <div className="h-[1px] flex-1 bg-white/10"></div>
                                <span className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] whitespace-nowrap">
                                    {plans[activePlanIndex].description}
                                </span>
                                <div className="h-[1px] flex-1 bg-white/10"></div>
                            </div>

                            <div className="flex flex-col gap-6">
                                {plans[activePlanIndex].features.map((feature, idx) => (
                                    <div key={idx} className="flex gap-4 items-start">
                                        <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${feature.included ? 'bg-primary text-white' : 'bg-white/5 text-white/20'}`}>
                                            <Icon name={feature.included ? "check" : "lock"} className="text-[16px]" filled={feature.included} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className={`text-[15px] font-bold ${feature.included ? 'text-white' : 'text-white/40'}`}>{feature.text}</span>
                                            {feature.subtext && <span className="text-xs text-white/40 mt-0.5 leading-snug">{feature.subtext}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-14 flex flex-col items-center gap-8">
                            <button
                                onClick={() => handleSubscribe(plans[activePlanIndex])}
                                disabled={updating || currentPlanId === plans[activePlanIndex].id}
                                className={`w-full h-20 rounded-[40px] font-black text-xl uppercase tracking-tight transition-all active:scale-95 disabled:opacity-50 overflow-hidden relative group ${plans[activePlanIndex].buttonTheme}`}
                            >
                                <div className="flex flex-col items-center justify-center h-full">
                                    {updating ? (
                                        <span className="text-white/60">Updating...</span>
                                    ) : currentPlanId === plans[activePlanIndex].id ? (
                                        <span>Current Plan</span>
                                    ) : (
                                        <>
                                            <span className="text-xs font-bold opacity-60 mb-0.5">Starting At</span>
                                            <span>{plans[activePlanIndex].price} {plans[activePlanIndex].period}</span>
                                        </>
                                    )}
                                </div>
                                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                            </button>
                        </div>
                    </div>

                    {/* Dot Indicators */}
                    <div className="flex justify-center gap-2 mb-4">
                        {plans.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setActivePlanIndex(idx)}
                                className={`h-2.5 rounded-full transition-all duration-300 ${activePlanIndex === idx ? 'w-8 bg-primary' : 'w-2.5 bg-white/10'}`}
                            />
                        ))}
                    </div>
                </div>

                {currentSubscriptionLevel !== 'FREE' && (
                    <div className="w-full mt-4 px-4 pb-4">
                        <button
                            onClick={handleManageSubscription}
                            disabled={portalLoading}
                            className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white/70 font-semibold hover:bg-white/10 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <Icon name="settings" className="text-xl" />
                            {portalLoading ? 'Loading Portal...' : 'Manage Subscription'}
                        </button>
                    </div>
                )}

                <div className="mt-auto pt-8 pb-4 text-center">
                    <p className="text-[10px] text-white/30 leading-relaxed px-6">
                        Recurring billing, cancel anytime. By continuing, you agree to our <span className="text-white/50 underline">Terms</span>. Subscriptions automatically renew unless auto-renew is turned off at least 24-hours before the end of the current period.
                    </p>
                </div>
            </main>
        </div>
    );
};

export default Subscription;
