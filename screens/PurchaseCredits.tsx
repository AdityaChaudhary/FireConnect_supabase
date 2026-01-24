import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { getStripeProducts, startStripeCheckout } from '../lib/stripe-utils';

interface StripeProduct {
    id: string;
    name: string;
    description: string;
    metadata: any;
    price_id: string;
    price_amount: number;
    price_currency: string;
    interval: string;
    price_attrs: any;
}

interface CreditPrice {
    id: string;
    unit_amount: number;
    currency: string;
    credits: number;
}

const PurchaseCredits: React.FC = () => {
    const { profile, stripeRole, session } = useAuth();
    const navigate = useNavigate();
    const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
    const [prices, setPrices] = useState<CreditPrice[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    useEffect(() => {
        const fetchCredits = async () => {
            try {
                const products = await getStripeProducts();
                // Filter for 'Spy Credits'
                const spyItems = (products as StripeProduct[]).filter(p => p.name === 'Spy Credits');

                if (spyItems.length > 0) {
                    const mappedPrices = spyItems
                        .map(item => {
                            // Extract credits from transform_quantity in price attributes
                            const attrs = item.price_attrs || {};
                            const transform = attrs.transform_quantity;
                            const credits = transform ? transform.divide_by : 0;

                            return {
                                id: item.price_id,
                                unit_amount: item.price_amount,
                                currency: item.price_currency,
                                credits: credits
                            };
                        })
                        .filter(p => p.credits > 0)
                        .sort((a, b) => a.unit_amount - b.unit_amount);

                    setPrices(mappedPrices);
                }
            } catch (error) {
                console.error("Error fetching credit packages:", error);
            } finally {
                setLoadingProducts(false);
            }
        };
        fetchCredits();
    }, []);

    const subscriptionLevel = stripeRole ? stripeRole.toUpperCase() : 'FREE';
    // Logic from source: allow purchase only if NOT free?
    // Source: isLiteMember = subscriptionLevel === 'FREE'
    // If isLiteMember, show "Upgrade Required".
    const isLiteMember = subscriptionLevel === 'FREE' || subscriptionLevel === 'LITE';

    const handlePurchase = async (priceId: string, credits: number) => {
        setLoadingPriceId(priceId);
        try {
            console.log('Starting checkout for priceId: ', priceId);
            await startStripeCheckout(priceId, 'payment', {
                credits,
                oldBalance: profile?.spy_credits || 0,
                authToken: session?.access_token
            });
        } catch (error: any) {
            console.error("Error starting checkout:", error);
            setNotification(error?.message || "Failed to initiate purchase. Please try again.");
        } finally {
            setLoadingPriceId(null);
        }
    };

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
            <header className="sticky top-0 z-20 flex w-full items-center justify-between px-4 py-8 bg-background-dark/80 backdrop-blur-md">
                <button
                    onClick={() => navigate(-1)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-dark text-white hover:bg-white/10 active:scale-95 transition-all"
                >
                    <Icon name="arrow_back" />
                </button>
                <h1 className="text-white text-lg font-bold">Spy Credits</h1>
                <div className="w-10"></div>
            </header>

            <main className="flex-1 flex flex-col items-center px-4 w-full max-w-md mx-auto">
                <div className="flex flex-col items-center gap-4 mb-10 text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-600 shadow-xl shadow-primary/20">
                        <Icon name="visibility" className="text-4xl text-white" filled />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black italic uppercase tracking-tighter">Get More Credits</h2>
                        <p className="text-white/60 text-sm mt-1">Unlock private photos and see who's who.</p>
                    </div>
                    <div className="px-6 py-2 rounded-full bg-primary/10 border border-primary/20">
                        <span className="text-primary font-bold text-sm">
                            Balance: {subscriptionLevel === 'MAX' ? '∞' : (profile?.spy_credits || 0)} Credits
                        </span>
                    </div>
                </div>

                {loadingProducts ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                    </div>
                ) : isLiteMember ? (
                    <div className="w-full flex flex-col gap-6 p-8 rounded-[40px] bg-surface-dark border border-white/5 text-center shadow-2xl">
                        <Icon name="lock" className="text-5xl text-white/20 mx-auto" />
                        <div className="flex flex-col gap-2">
                            <h3 className="text-xl font-bold">Upgrade Required</h3>
                            <p className="text-white/50 text-sm">
                                Individual credit purchases are only available for Pro and Max members.
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/subscription')}
                            className="w-full h-16 rounded-full bg-gradient-to-r from-primary to-purple-600 text-white font-black text-lg uppercase tracking-tight shadow-lg shadow-primary/25 active:scale-95 transition-all"
                        >
                            Upgrade Now
                        </button>
                    </div>
                ) : (
                    <div className="w-full flex flex-col gap-4">
                        {prices.length > 0 ? (
                            prices.map((price) => (
                                <button
                                    key={price.id}
                                    onClick={() => handlePurchase(price.id, price.credits)}
                                    disabled={loadingPriceId !== null}
                                    className="w-full p-6 rounded-[32px] bg-surface-dark border border-white/5 hover:border-primary/50 transition-all active:scale-[0.98] group relative overflow-hidden"
                                >
                                    <div className="flex items-center justify-between relative z-10">
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                                <Icon name="bolt" filled />
                                            </div>
                                            <div className="flex flex-col items-start">
                                                <span className="text-xl font-bold text-white leading-tight">{price.credits} Credits</span>
                                                <span className="text-white/40 text-xs font-bold uppercase tracking-widest mt-0.5">SPY PACKAGE</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            {loadingPriceId === price.id ? (
                                                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                                            ) : (
                                                <span className="text-2xl font-black text-primary italic">
                                                    ${((price.unit_amount || 0) / 100).toFixed(0)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                </button>
                            ))
                        ) : (
                            <div className="text-center py-10">
                                <p className="text-white/40">No credit packages available at the moment.</p>
                            </div>
                        )}
                    </div>
                )}

                <div className="mt-12 text-center px-8">
                    <p className="text-[10px] text-white/30 leading-relaxed italic">
                        Credits are one-time purchases and do not expire. Use them to reveal private photos of other users. Terms and conditions apply.
                    </p>
                </div>
            </main>
        </div>
    );
};

export default PurchaseCredits;
