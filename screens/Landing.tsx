import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getStripeProducts } from '../lib/stripe-utils';
import { PLAN_THEMES, PLAN_DESCRIPTIONS, PLAN_FEATURES } from '../config/plans';
import CdnImage from '../components/CdnImage';
import { getDefaultAvatar } from '../lib/image-utils';

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
}

const Landing: React.FC = () => {
    const { signInWithGoogle } = useAuth();

    const handleAuth = async (intent?: string | { type: string, id?: string } | React.MouseEvent) => {
        try {
            if (typeof intent === 'string') {
                localStorage.setItem('auth_intent', JSON.stringify({ type: 'profile', id: intent }));
            } else if (intent && typeof intent === 'object' && 'type' in intent) {
                localStorage.setItem('auth_intent', JSON.stringify(intent));
            }
            await signInWithGoogle();
        } catch (error) {
            console.error('Login failed:', error);
        }
    };

    const [plans, setPlans] = useState<Plan[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [aiUsers, setAiUsers] = useState<any[]>([]);
    const [loadingAIUsers, setLoadingAIUsers] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                // Use the wrapper function for consistency
                const products = await getStripeProducts() as any[];

                // Filter out Spy Credits and map
                const activePlans = products.filter(p => !p.name.includes('Spy Credits'));

                if (activePlans && Array.isArray(activePlans)) {
                    const mappedPlans = activePlans.map((product: any) => {
                        const metadata = product.metadata || {};
                        const role = (metadata.role || product.name || 'PRO').toUpperCase();

                        let themeKey = 'PRO';
                        if (role.includes('MAX')) themeKey = 'MAX';
                        else if (role.includes('PRO')) themeKey = 'PRO';
                        else if (role.includes('LITE') || role.includes('FREE')) themeKey = 'FREE';

                        const theme = PLAN_THEMES[themeKey] || PLAN_THEMES.PRO;

                        // Handle price from the flat view returned by RPC or the nested structure if different
                        // The RPC returns specific fields: price_amount, price_currency, interval
                        // But getStripeProducts returns the usage of get_active_plans which returns:
                        // id, name, description, price_id, price_amount, price_currency, interval, metadata

                        const unitAmount = product.price_amount;
                        const currency = product.price_currency || 'USD';
                        const interval = product.interval;

                        const formattedPrice = unitAmount
                            ? (unitAmount / 100).toLocaleString('en-US', {
                                style: 'currency',
                                currency: currency.toUpperCase(),
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2
                            })
                            : '$0';

                        const period = interval ? `/ ${interval === 'month' ? 'mo' : interval}` : '';

                        // Feature mapping logic from Subscription.tsx/Source
                        let features = PLAN_FEATURES[themeKey] || [];
                        if (metadata.features) {
                            try {
                                const featuresList = (metadata.features as string).split(',').filter(f => f.trim().length > 0);
                                features = featuresList.map(f => ({
                                    text: f.trim(),
                                    included: true
                                }));
                            } catch (e) {
                                console.warn('Failed to parse plan features', e);
                            }
                        }

                        return {
                            id: themeKey,
                            name: product.name,
                            price: formattedPrice,
                            period: period,
                            description: product.description || PLAN_DESCRIPTIONS[themeKey] || '',
                            features: features,
                            ...theme
                        };
                    });

                    setPlans(mappedPlans.sort((a, b) => {
                        const order = { 'FREE': 0, 'PRO': 1, 'MAX': 2 };
                        return (order[a.id as keyof typeof order] || 0) - (order[b.id as keyof typeof order] || 0);
                    }));
                }
            } catch (error) {
                console.error("Error fetching plans:", error);
                // Fallback
                setPlans([
                    {
                        id: 'FREE',
                        name: 'LITE',
                        price: '$0',
                        period: '/ mo',
                        description: PLAN_DESCRIPTIONS.FREE,
                        features: PLAN_FEATURES.FREE,
                        ...PLAN_THEMES.FREE
                    }
                ]);
            } finally {
                setLoadingProducts(false);
            }
        };

        const fetchAIUsers = async () => {
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('*, user_online_status(*)')
                    .eq('user_type', 'AI')
                    .limit(20);

                if (error) throw error;

                // Shuffle logic
                const shuffled = [...(data || [])];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                setAiUsers(shuffled.slice(0, 10));
            } catch (error) {
                console.error("Error fetching AI users:", error);
            } finally {
                setLoadingAIUsers(false);
            }
        };

        fetchPlans();
        fetchAIUsers();
    }, []);

    // Set initial scroll position to middle
    useEffect(() => {
        if (!loadingAIUsers && aiUsers.length > 0 && scrollRef.current) {
            const container = scrollRef.current;
            const scrollWidth = container.scrollWidth;
            container.scrollLeft = scrollWidth / 3;
        }
    }, [loadingAIUsers, aiUsers.length]);

    const handleScroll = (direction: 'left' | 'right') => {
        if (!scrollRef.current) return;
        const container = scrollRef.current;
        const scrollAmount = 350;
        container.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
        });
    };

    const onScroll = () => {
        if (!scrollRef.current) return;
        const container = scrollRef.current;
        const { scrollLeft, scrollWidth, clientWidth } = container;

        const third = scrollWidth / 3;
        if (scrollLeft < 50) {
            container.scrollLeft = third + scrollLeft;
        } else if (scrollLeft + clientWidth > scrollWidth - 50) {
            container.scrollLeft = scrollLeft - third;
        }
    };

    useEffect(() => {
        document.documentElement.classList.add('landing-theme');
        return () => {
            document.documentElement.classList.remove('landing-theme');
        };
    }, []);

    return (
        <div className="bg-background-dark text-white overflow-x-hidden selection:bg-fire-pink selection:text-white font-sans">
            <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-background-dark/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-[1400px] mx-auto px-6 md:px-12">
                    <div className="flex items-center justify-between h-24">
                        <div className="flex items-center gap-2 text-white group cursor-pointer">
                            <div className="flex items-center justify-center size-10 bg-gradient-to-tr from-fire-pink to-neon-purple rounded-xl shadow-[0_0_15px_rgba(255,0,85,0.5)] group-hover:shadow-[0_0_25px_rgba(255,0,85,0.8)] transition-all">
                                <span className="material-symbols-outlined text-2xl text-white">local_fire_department</span>
                            </div>
                            <h2 className="text-white text-2xl font-black tracking-tighter uppercase ml-1">Fire<span className="text-transparent bg-clip-text bg-gradient-to-r from-fire-pink to-neon-purple">Connect</span></h2>
                        </div>
                        <div className="hidden md:flex items-center gap-10">
                            <a className="text-gray-400 hover:text-white text-sm font-semibold tracking-wide uppercase transition-colors" href="#discover">Discover</a>
                            <a className="text-gray-400 hover:text-white text-sm font-semibold tracking-wide uppercase transition-colors" href="#vaults">Vaults</a>
                            <a className="text-gray-400 hover:text-white text-sm font-semibold tracking-wide uppercase transition-colors" href="#membership">Membership</a>
                        </div>
                        <div className="flex items-center gap-6">
                            <button onClick={() => handleAuth()} className="text-gray-300 text-sm font-semibold hover:text-white transition-colors hidden sm:block uppercase tracking-wide">Login</button>
                            <button onClick={() => handleAuth()} className="flex items-center justify-center rounded-full h-12 px-8 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-fire-pink/50 text-white text-sm font-bold tracking-wider uppercase transition-all duration-300 group">
                                <span>Join</span>
                                <span className="material-symbols-outlined text-lg ml-2 group-hover:text-fire-pink transition-colors">arrow_forward</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <section className="relative min-h-[95vh] flex items-center justify-center pt-52 pb-32 overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <CdnImage
                        path="https://lh3.googleusercontent.com/aida-public/AB6AXuAgjxMpW4WVYBYghX_t95Rgw78gdZgzFBpi-KjvaLXjabyRFG1eEW0ITSD1ZESiSUhn7doxUfIQtjFWeIGL7D967lqoyvJ2WWeCa5YesTrThpx7GVJCeYQclNvGzaHIxX6RBmfTdee1nmUEsFZpSWiI1RYW1KLPE21YGZK6SN7hsqZM6jaIaBfBaVXVZfAEihl313HV5whoqRt9gVI3YXEOuceAGPQPcD1_IpzXpJBqpqg_PoDg1Je3cHJRVRjvPQ8aVGD9f4zDbUuI"
                        useAsBackground
                        className="w-full h-full bg-cover bg-center bg-no-repeat scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-charcoal/90 via-charcoal/80 to-charcoal"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-charcoal via-transparent to-charcoal/90"></div>
                    <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-neon-purple/20 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-fire-pink/10 rounded-full blur-[100px] mix-blend-screen animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
                </div>
                <div className="relative z-10 container mx-auto px-4 text-center max-w-5xl">
                    <div className="flex flex-col gap-8 items-center animate-fade-in-up">
                        <div className="inline-flex items-center gap-2 py-2 px-6 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-lg shadow-neon-purple/10">
                            <span className="w-2 h-2 rounded-full bg-fire-pink animate-pulse"></span>
                            <span className="text-xs font-bold tracking-[0.2em] uppercase text-white">Premium Adult Discovery</span>
                        </div>
                        <h1 className="text-white text-6xl md:text-8xl font-black leading-[0.95] tracking-tighter drop-shadow-2xl">
                            Ignite Intimate <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple via-white to-fire-pink text-glow">Connections</span>
                        </h1>
                        <p className="text-gray-400 text-lg md:text-2xl font-light max-w-3xl leading-relaxed mt-4">
                            Enter a world of luxury, privacy, and uninhibited connection. The most exclusive network for verified adults.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-6 justify-center mt-10">
                            <button onClick={() => handleAuth()} className="btn-glow flex min-w-[240px] cursor-pointer items-center justify-center rounded-full h-16 px-10 bg-gradient-to-r from-neon-purple to-primary text-white text-lg font-bold tracking-widest uppercase hover:scale-105 transition-transform duration-300">
                                Launch Your Discovery
                            </button>
                        </div>
                        <div className="mt-16 flex items-center justify-center gap-8 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                            <div className="flex flex-col items-center gap-1">
                                <span className="material-symbols-outlined text-3xl">verified_user</span>
                                <span className="text-[10px] uppercase tracking-widest font-bold">Verified</span>
                            </div>
                            <div className="w-px h-8 bg-white/20"></div>
                            <div className="flex flex-col items-center gap-1">
                                <span className="material-symbols-outlined text-3xl">encrypted</span>
                                <span className="text-[10px] uppercase tracking-widest font-bold">Encrypted</span>
                            </div>
                            <div className="w-px h-8 bg-white/20"></div>
                            <div className="flex flex-col items-center gap-1">
                                <span className="material-symbols-outlined text-3xl">diamond</span>
                                <span className="text-[10px] uppercase tracking-widest font-bold">Exclusive</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="discover" className="py-24 bg-background-dark relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-fire-pink/50 to-transparent"></div>
                <div className="max-w-[1400px] mx-auto px-6 mb-12 flex items-end justify-between">
                    <div>
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">Live Now</h2>
                        <p className="text-gray-400">Members active in your area</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleScroll('left')}
                            className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors text-white"
                        >
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <button
                            onClick={() => handleScroll('right')}
                            className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors text-white"
                        >
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>
                </div>
                <div
                    ref={scrollRef}
                    onScroll={onScroll}
                    className="flex overflow-x-auto hide-scrollbar gap-6 px-6 md:px-12 pb-12 snap-x"
                >
                    {loadingAIUsers ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="min-w-[280px] md:min-w-[320px] aspect-[3/4] bg-white/5 rounded-[32px] animate-pulse"></div>
                        ))
                    ) : aiUsers.length === 0 ? (
                        <div className="w-full text-center py-10 text-gray-500 font-bold uppercase tracking-widest">
                            Finding members...
                        </div>
                    ) : (
                        [...aiUsers, ...aiUsers, ...aiUsers].map((member, i) => {
                            const lastSeen = member.user_online_status?.[0]?.last_seen_at;
                            const isOnline = lastSeen ? (Date.now() - new Date(lastSeen).getTime()) < 120000 : false;
                            const age = member.date_of_birth ? new Date().getFullYear() - new Date(member.date_of_birth).getFullYear() : 22;
                            const profilePic = member.profile_picture_url || getDefaultAvatar(member.gender);

                            return (
                                <div key={`${member.id}-${i}`} className="min-w-[280px] md:min-w-[320px] snap-center group relative cursor-pointer" onClick={() => handleAuth(member.id)}>
                                    <div className={`glass-card rounded-super p-3 transition-all duration-300 group-hover:bg-white/5 group-hover:-translate-y-2 ${i % aiUsers.length === 1 ? 'border-neon-purple/30 shadow-[0_0_20px_rgba(164,19,236,0.15)]' : ''}`}>
                                        <div className="relative aspect-[3/4] rounded-[32px] overflow-hidden mb-4">
                                            <div className="absolute top-4 left-4 z-20 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-gray-400'}`}></span>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-white">{isOnline ? 'Online' : 'Offline'}</span>
                                            </div>
                                            <CdnImage
                                                path={profilePic}
                                                placeholder={getDefaultAvatar(member.gender)}
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                                        </div>
                                        <div className="px-2 pb-2">
                                            <div className="flex justify-between items-center mb-1">
                                                <h3 className="text-xl font-bold text-white line-clamp-1">{member.display_name || 'Discovery'}, {age}</h3>
                                                <span className="material-symbols-outlined text-xl text-gray-500 group-hover:text-fire-pink transition-colors">favorite</span>
                                            </div>
                                            <p className="text-gray-400 text-sm flex items-center gap-1">
                                                <span className="material-symbols-outlined text-sm">location_on</span>
                                                {member.location || 'Nearby'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </section>

            <section id="vaults" className="py-24 bg-[#0a0a0c]">
                <div className="max-w-[1200px] mx-auto px-6">
                    <div className="glass-card rounded-super p-8 md:p-16 border border-white/5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-neon-purple/10 to-transparent pointer-events-none"></div>
                        <div className="grid md:grid-cols-2 gap-16 items-center relative z-10">
                            <div className="order-2 md:order-1">
                                <div className="flex items-center gap-3 mb-6">
                                    <span className="flex items-center justify-center w-10 h-10 rounded-full bg-fire-pink/20 text-fire-pink">
                                        <span className="material-symbols-outlined text-xl">visibility_off</span>
                                    </span>
                                    <span className="text-fire-pink font-bold tracking-[0.2em] uppercase text-sm">Spy Mode</span>
                                </div>
                                <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-[1.1]">
                                    Private Vaults & <br />
                                    <span className="text-gray-500">Touch to Reveal</span>
                                </h2>
                                <p className="text-gray-400 text-lg leading-relaxed mb-8">
                                    Experience the thrill of the unknown. Our exclusive "Spy Mode" lets you securely peek into private galleries. Use the toggle to initiate a discreet scan of blurred content.
                                </p>
                                <div className="flex items-center gap-6 mb-10">
                                    <div className="bg-background-dark p-4 rounded-2xl border border-white/10 flex items-center gap-4">
                                        <div className="w-12 h-6 bg-fire-pink rounded-full relative cursor-pointer shadow-[0_0_10px_rgba(255,0,85,0.4)]">
                                            <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                                        </div>
                                        <span className="font-bold text-white uppercase text-sm tracking-wide">Spy Mode Active</span>
                                    </div>
                                </div>
                                <ul className="space-y-4">
                                    <li className="flex items-center gap-4 text-gray-300">
                                        <span className="material-symbols-outlined text-neon-purple">lock_open</span>
                                        <span>Temporary access to locked media</span>
                                    </li>
                                    <li className="flex items-center gap-4 text-gray-300">
                                        <span className="material-symbols-outlined text-neon-purple">history</span>
                                        <span>Self-destructing previews</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="relative order-1 md:order-2">
                                <div className="relative w-full aspect-[4/5] md:aspect-square rounded-[40px] overflow-hidden border border-white/10 shadow-2xl">
                                    <div className="absolute inset-0 w-full h-full bg-black">
                                        <CdnImage
                                            path="https://lh3.googleusercontent.com/aida-public/AB6AXuA9Pg6jndpLLJVSPEMbe9GHz4kGr0UJnWGDkFhG3qHpIeivNctbFVSYFcyJEj3WOywabNBu1zGDnnJ47T2SisF6XR6pNePY1hZJc3TrRGGScP4ZsweTLPv2WLR435fuiWEDzmm9os_q2GZdudsiyMtKhTRLGRHFfHpmQe2pwPIx7wV-TAC2wjwV27j26ekEWAw3FYeAW4uTmVe514Wdfoy3iGc4nxedAiZpFYTrphL8aJyX9wIX5qa90Y-JI1X4DEVNSWeuLKEkUJ9X"
                                            useAsBackground
                                            className="w-full h-full bg-cover bg-center filter blur-lg scale-105 opacity-80"
                                        />
                                        <div className="absolute w-full h-1 bg-fire-pink shadow-[0_0_20px_#ff0055] animate-scan z-20 top-0 left-0"></div>
                                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-fire-pink/10 to-transparent z-10 animate-scan" style={{ height: '20%' }}></div>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center z-30">
                                            <div className="bg-black/40 backdrop-blur-xl p-8 rounded-full border border-white/20 mb-6 shadow-xl">
                                                <span className="material-symbols-outlined text-white text-5xl">fingerprint</span>
                                            </div>
                                            <span className="text-white/80 font-bold text-sm tracking-[0.3em] uppercase animate-pulse">Scanning Vault...</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="membership" className="py-24 bg-background-dark relative">
                <div className="max-w-[1200px] mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-black text-white mb-4">Choose Your Access</h2>
                        <p className="text-gray-400">Unlock the full potential of FireConnect</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6 items-center">
                        {loadingProducts ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-20">
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-fire-pink mb-4"></div>
                                <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Fetching Exclusive Plans...</p>
                            </div>
                        ) : (
                            plans.map((plan) => (
                                <div key={plan.id} className={`relative glass-card rounded-super p-8 transition-all hover:bg-white/5 border border-white/5 ${plan.id === 'PRO' ? 'bg-[#1a1120] border-neon-purple/50 shadow-[0_0_30px_rgba(164,19,236,0.15)] md:scale-105 z-10' : ''}`}>
                                    {plan.id === 'PRO' && (
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-neon-purple text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg shadow-neon-purple/40">Recommended</div>
                                    )}
                                    <h3 className={`text-2xl font-bold text-white mb-2 ${plan.id === 'PRO' ? 'text-glow' : ''}`}>{plan.name}</h3>
                                    <div className="text-4xl font-black text-white mb-6">
                                        {plan.price}
                                        <span className="text-lg text-gray-400 font-normal">{plan.period}</span>
                                    </div>
                                    <ul className="space-y-4 mb-8">
                                        {plan.features.map((feature, fIdx) => (
                                            <li key={fIdx} className={`flex items-start gap-3 text-sm ${feature.included ? 'text-gray-200' : 'text-gray-500 line-through'}`}>
                                                <span className={`material-symbols-outlined text-lg ${feature.included ? (plan.id === 'MAX' ? 'text-fire-pink' : 'text-neon-purple') : 'text-gray-500'}`}>
                                                    {feature.included ? (plan.id === 'PRO' ? 'check_circle' : 'check') : 'close'}
                                                </span>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{feature.text}</span>
                                                    {feature.subtext && <span className="text-[10px] opacity-60 mt-0.5 leading-tight">{feature.subtext}</span>}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                    <button
                                        onClick={() => handleAuth({ type: 'subscription' })}
                                        className={`w-full py-4 rounded-full font-bold text-sm transition-all uppercase tracking-wider ${plan.id === 'PRO'
                                            ? 'bg-gradient-to-r from-neon-purple to-primary text-white hover:shadow-lg'
                                            : plan.id === 'MAX'
                                                ? 'border border-fire-pink/50 text-fire-pink hover:bg-fire-pink hover:text-white'
                                                : 'border border-white/20 text-white hover:bg-white/10'
                                            }`}
                                    >
                                        {plan.id === 'FREE' ? 'Select Lite' : plan.id === 'PRO' ? 'Start Pro' : 'Select Max'}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </section>

            <section className="py-20 bg-[#0f0f11] border-t border-white/5">
                <div className="max-w-[1200px] mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
                        <div className="flex flex-col items-center gap-4 group">
                            <div className="w-20 h-20 rounded-3xl bg-surface-dark border border-white/10 flex items-center justify-center group-hover:border-neon-purple/50 transition-colors">
                                <span className="material-symbols-outlined text-4xl text-gray-300 group-hover:text-neon-purple transition-colors">lock_person</span>
                            </div>
                            <h3 className="text-xl font-bold text-white">Secure Vaults</h3>
                            <p className="text-gray-500 text-sm max-w-xs">Your content is AES-256 encrypted and only visible to those you allow.</p>
                        </div>
                        <div className="flex flex-col items-center gap-4 group">
                            <div className="w-20 h-20 rounded-3xl bg-surface-dark border border-white/10 flex items-center justify-center group-hover:border-neon-purple/50 transition-colors">
                                <span className="material-symbols-outlined text-4xl text-gray-300 group-hover:text-neon-purple transition-colors">smart_toy</span>
                            </div>
                            <h3 className="text-xl font-bold text-white">Smart Matching</h3>
                            <p className="text-gray-500 text-sm max-w-xs">Advanced matching algorithms that learn your specific desires over time.</p>
                        </div>
                        <div className="flex flex-col items-center gap-4 group">
                            <div className="w-20 h-20 rounded-3xl bg-surface-dark border border-white/10 flex items-center justify-center group-hover:border-neon-purple/50 transition-colors">
                                <span className="material-symbols-outlined text-4xl text-gray-300 group-hover:text-neon-purple transition-colors">near_me</span>
                            </div>
                            <h3 className="text-xl font-bold text-white">Proximity Matching</h3>
                            <p className="text-gray-500 text-sm max-w-xs">Find verified members within your immediate vicinity instantly.</p>
                        </div>
                    </div>
                </div>
            </section>

            <footer className="bg-background-dark pt-24 pb-12 border-t border-white/5">
                <div className="max-w-[1200px] mx-auto px-6">
                    <div className="flex flex-col items-center justify-center mb-20 text-center">
                        <h2 className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tighter">Ready to Burn?</h2>
                        <button onClick={() => handleAuth()} className="btn-glow w-full max-w-[320px] h-20 rounded-full bg-fire-pink text-white text-xl font-bold tracking-widest uppercase hover:bg-fire-pink/90 transition-all shadow-[0_0_30px_rgba(255,0,85,0.4)]">
                            Join the Fire
                        </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-10 py-12 border-t border-white/5">
                        <div className="flex flex-col gap-6">
                            <div className="flex items-center gap-2 text-white">
                                <span className="material-symbols-outlined text-fire-pink">local_fire_department</span>
                                <span className="font-bold text-xl uppercase tracking-tighter">FireConnect</span>
                            </div>
                            <p className="text-gray-500 text-sm leading-relaxed">The premium destination for authentic adult connections in a secure, luxury environment.</p>
                        </div>
                        <div className="flex flex-col gap-4">
                            <h4 className="text-white font-bold uppercase text-sm tracking-wider">Company</h4>
                            <a className="text-gray-400 hover:text-fire-pink text-sm transition-colors" href="#">About</a>
                            <a className="text-gray-400 hover:text-fire-pink text-sm transition-colors" href="#">Careers</a>
                            <a className="text-gray-400 hover:text-fire-pink text-sm transition-colors" href="#">Press</a>
                        </div>
                        <div className="flex flex-col gap-4">
                            <h4 className="text-white font-bold uppercase text-sm tracking-wider">Legal</h4>
                            <a className="text-gray-400 hover:text-fire-pink text-sm transition-colors" href="#">Privacy Policy</a>
                            <a className="text-gray-400 hover:text-fire-pink text-sm transition-colors" href="#">Terms</a>
                            <a className="text-gray-400 hover:text-fire-pink text-sm transition-colors" href="#">2257 Exempt</a>
                        </div>
                        <div className="flex flex-col gap-4">
                            <h4 className="text-white font-bold uppercase text-sm tracking-wider">Social</h4>
                            <div className="flex gap-4">
                                <a className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-fire-pink transition-colors text-white" href="#">
                                    <span className="text-xs">IG</span>
                                </a>
                                <a className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-fire-pink transition-colors text-white" href="#">
                                    <span className="text-xs">X</span>
                                </a>
                            </div>
                        </div>
                    </div>
                    <div className="text-center pt-8 border-t border-white/5">
                        <p className="text-gray-600 text-xs uppercase tracking-widest">© 2023 FireConnect. All rights reserved. 18+ content.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
