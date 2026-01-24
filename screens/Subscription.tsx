import React, { useState, useEffect } from 'react';
import { useNavigate, useLoaderData } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useStripeProducts } from '../hooks/useData';
import { getProcessedStripeProducts, startStripeCheckout, redirectToCustomerPortal, type Plan } from '../lib/stripe-utils';
import { createSupabaseServerClient } from '../lib/supabase.server';
import type { Route } from './+types/Subscription';

export async function loader({ request }: Route.LoaderArgs) {
    const { supabase } = createSupabaseServerClient(request);
    const plans = await getProcessedStripeProducts(supabase);
    return { plans: plans || [] };
}


// Data is now processed in the hook/loader, so we don't need redundant effects

const Subscription: React.FC = () => {
    const { stripeRole, refreshProfile, session } = useAuth();
    const loaderData = useLoaderData<typeof loader>();
    const navigate = useNavigate();
    const [updating, setUpdating] = useState(false);
    const [portalLoading, setPortalLoading] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);
    const { data: plans = [], isLoading: loadingProducts } = useStripeProducts(loaderData?.plans);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    // Data is now processed in the hook/loader, so we don't need redundant effects


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
                setNotification("Subscription updated successfully!");
                setTimeout(() => navigate('/profile'), 1500);
            } catch (error) {
                console.error("Error updating subscription:", error);
                setNotification("Failed to update subscription.");
                setUpdating(false);
            }
            return;
        }

        if (!plan.priceId) {
            setNotification("This plan is currently unavailable.");
            return;
        }

        setUpdating(true);
        try {
            await startStripeCheckout(plan.priceId, 'subscription', { planId: plan.id, authToken: session?.access_token });
        } catch (error: any) {
            console.error("Error starting checkout:", error);
            setNotification("Could not initiate checkout. Please try again!");
            setUpdating(false);
        }
    };

    const handleManageSubscription = async () => {
        setPortalLoading(true);
        try {
            await redirectToCustomerPortal(session?.access_token);
        } catch (error: any) {
            console.error("Error redirecting to customer portal:", error);
            setNotification(error?.message || "Failed to open subscription management.");
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


    if (plans.length === 0) return null;

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-background-dark text-white pb-10">
            {/* Notification */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: -20, x: '-50%' }}
                        className="fixed top-10 left-1/2 z-[100] bg-black/80 backdrop-blur-md border border-white/10 px-6 py-3 rounded-full shadow-2xl flex items-center gap-2"
                    >
                        <p className="text-white text-sm font-bold tracking-tight">{notification}</p>
                    </motion.div>
                )}
            </AnimatePresence>

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
                        className="flex absolute left-[-16px] lg:left-[-100px] top-1/2 -translate-y-1/2 w-12 h-12 lg:w-16 lg:h-16 items-center justify-center rounded-full bg-white/5 border border-white/10 backdrop-blur-xl hover:bg-white/10 transition-all active:scale-90 group z-10"
                        aria-label="Previous Plan"
                    >
                        <Icon name="chevron_left" className="text-2xl lg:text-4xl text-white/50 group-hover:text-white transition-colors" />
                    </button>
                    <button
                        onClick={nextPlan}
                        className="flex absolute right-[-16px] lg:right-[-100px] top-1/2 -translate-y-1/2 w-12 h-12 lg:w-16 lg:h-16 items-center justify-center rounded-full bg-white/5 border border-white/10 backdrop-blur-xl hover:bg-white/10 transition-all active:scale-90 group z-10"
                        aria-label="Next Plan"
                    >
                        <Icon name="chevron_right" className="text-2xl lg:text-4xl text-white/50 group-hover:text-white transition-colors" />
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
                                {plans[activePlanIndex].features.map((feature: any, idx: number) => (
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
                    <div className="w-full mt-4 px-4 flex flex-col gap-3">

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
