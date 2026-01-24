import React, { useState } from 'react';
import type { MetaFunction } from "react-router";
import { useLoaderData } from 'react-router';
import { useSafeNavigate } from '../hooks/useSafeNavigate';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { createSupabaseServerClient } from '../lib/supabase.server';
import type { Route } from './+types/Settings';

export const meta: MetaFunction = () => {
    return [
        { title: "Settings | FireConnect" },
        { name: "description", content: "Manage your account settings, privacy, and subscription." },
    ];
};

export async function loader({ request }: Route.LoaderArgs) {
    const { supabase } = createSupabaseServerClient(request);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { stats: null };

    const [connectionsRes, spyCountRes] = await Promise.all([
        supabase
            .from('connections')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'CONNECTED')
            .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`),
        supabase
            .from('spied_profiles')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
    ]);

    return {
        stats: {
            matchCount: connectionsRes.count || 0,
            spyCount: spyCountRes.count || 0,
            memberSince: user.created_at
        }
    };
}

const Settings: React.FC = () => {
    const { logout, stripeRole, profile } = useAuth();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const loaderData = useLoaderData<typeof loader>();
    const { safeNavigate, safeBack } = useSafeNavigate();


    const stats = loaderData?.stats;



    return (
        <div className="flex min-h-screen w-full flex-col bg-background-dark text-white pb-24">
            {/* Header */}
            <header className="sticky top-0 z-20 flex w-full items-center gap-4 bg-background-dark/80 px-4 py-3 backdrop-blur-md border-b border-white/5">
                <button
                    onClick={() => safeBack()}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-dark text-white hover:bg-white/10 active:scale-95 transition-all"
                >
                    <Icon name="arrow_back" />
                </button>
                <span className="text-lg font-bold tracking-tight">Settings</span>
            </header>

            <main className="flex-1 flex flex-col px-4 pt-6 gap-6 w-full max-w-md mx-auto">
                
                {/* Account Info Section */}
                <div className="flex flex-col gap-2">
                    <h3 className="text-white/50 text-[10px] font-black uppercase tracking-[0.2em] px-2 mb-1">Account Info</h3>
                    <div className="flex flex-col rounded-[24px] bg-surface-dark overflow-hidden border border-white/5 shadow-xl">
                        <div className="flex items-center gap-3 p-4 px-5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/60">
                                <Icon name="person" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-white/40 font-black uppercase tracking-widest leading-none mb-1">Username</span>
                                <span className="text-sm font-bold">{profile?.username || '—'}</span>
                            </div>
                        </div>
                        <div className="h-px w-full bg-white/5 mx-5"></div>
                        <div className="flex items-center gap-3 p-4 px-5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/60">
                                <Icon name="mail" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-white/40 font-black uppercase tracking-widest leading-none mb-1">Email</span>
                                <span className="text-sm font-bold">{profile?.email || '—'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Statistics Section */}
                {stats && (
                    <div className="flex flex-col gap-2">
                        <h3 className="text-white/50 text-[10px] font-black uppercase tracking-[0.2em] px-2 mb-1">Account Statistics</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col items-center justify-center gap-1 rounded-[32px] bg-surface-dark p-6 border border-white/5 shadow-xl">
                                <span className="text-white/40 text-[10px] font-black uppercase tracking-widest text-center">Total Matches</span>
                                <span className="text-3xl font-black text-white">{stats.matchCount}</span>
                            </div>
                            <div className="flex flex-col items-center justify-center gap-1 rounded-[32px] bg-surface-dark p-6 border border-white/5 shadow-xl">
                                <span className="text-white/40 text-[10px] font-black uppercase tracking-widest text-center">Profiles Spied</span>
                                <span className="text-3xl font-black text-white">{stats.spyCount}</span>
                            </div>
                        </div>
                        <div className="mt-1 px-4 text-center">
                            <p className="text-[10px] text-white/30 font-bold tracking-tight">
                                Member since {new Date(stats.memberSince).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                )}

                {/* Subscription Section */}
                <div className="flex flex-col gap-2">
                    <h3 className="text-white/50 text-[10px] font-black uppercase tracking-[0.2em] px-2 mb-1">Subscription</h3>
                    <div className="flex flex-col rounded-[24px] bg-surface-dark overflow-hidden border border-white/5 shadow-xl">
                        <button
                            onClick={() => safeNavigate('/subscription')}
                            className="flex w-full items-center justify-between p-4 px-5 active:bg-white/5 transition-colors text-left group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/60 group-hover:text-primary transition-colors">
                                    <Icon name="credit_card" />
                                </div>
                                <span className="text-sm font-bold">Manage Subscription</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {stripeRole && stripeRole !== 'FREE' && (
                                    <span className="text-[10px] font-black bg-primary/20 text-primary px-3 py-1 rounded-full uppercase tracking-widest">
                                        {stripeRole}
                                    </span>
                                )}
                                <Icon name="chevron_right" className="text-white/20" />
                            </div>
                        </button>
                        <div className="h-px w-full bg-white/5 mx-5"></div>
                        <button
                            onClick={() => safeNavigate('/purchase-credits')}
                            className="flex w-full items-center justify-between p-4 px-5 active:bg-white/5 transition-colors text-left group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/60 group-hover:text-primary transition-colors">
                                    <Icon name="visibility" filled />
                                </div>
                                <span className="text-sm font-bold">Spy Credits</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 bg-white/5 px-3 py-1 rounded-full">
                                    <Icon name="bolt" className="text-[10px] text-primary" filled />
                                    <span className="text-xs font-black text-white">
                                        {stripeRole === 'max' ? '∞' : (profile?.spy_credits || 0)}
                                    </span>
                                </div>
                                <Icon name="chevron_right" className="text-white/20" />
                            </div>
                        </button>
                    </div>
                </div>

                {/* Policy Settings Section */}
                <div className="flex flex-col gap-2">
                    <h3 className="text-white/50 text-[10px] font-black uppercase tracking-[0.2em] px-2 mb-1">Policy</h3>
                    <div className="flex flex-col rounded-[24px] bg-surface-dark overflow-hidden border border-white/5 shadow-xl">
                        <button 
                            onClick={() => safeNavigate('/settings/privacy')}
                            className="flex w-full items-center justify-between p-4 px-5 active:bg-white/5 transition-colors text-left group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/60 group-hover:text-primary transition-colors">
                                    <Icon name="lock" />
                                </div>
                                <span className="text-sm font-bold">Privacy Policy</span>
                            </div>
                            <Icon name="chevron_right" className="text-white/20" />
                        </button>
                        <div className="h-px w-full bg-white/5 mx-5"></div>
                        <button 
                            onClick={() => safeNavigate('/settings/terms')}
                            className="flex w-full items-center justify-between p-4 px-5 active:bg-white/5 transition-colors text-left group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/60 group-hover:text-primary transition-colors">
                                    <Icon name="description" />
                                </div>
                                <span className="text-sm font-bold">Terms & Conditions</span>
                            </div>
                            <Icon name="chevron_right" className="text-white/20" />
                        </button>
                    </div>
                </div>

                {/* Support Section */ }
                <div className="flex flex-col gap-2">
                    <h3 className="text-white/50 text-[10px] font-black uppercase tracking-[0.2em] px-2 mb-1">Support</h3>
                    <div className="flex flex-col rounded-[24px] bg-surface-dark overflow-hidden border border-white/5 shadow-xl">
                        <button 
                            onClick={() => window.open('https://groups.google.com/g/fireconnect', '_blank')}
                            className="flex w-full items-center justify-between p-4 px-5 active:bg-white/5 transition-colors text-left group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/60 group-hover:text-primary transition-colors">
                                    <Icon name="help" />
                                </div>
                                <span className="text-sm font-bold">Help Center</span>
                            </div>
                            <Icon name="chevron_right" className="text-white/20" />
                        </button>
                    </div>
                </div>

                {/* App Guide Section */}
                <div className="flex flex-col gap-2">
                    <h3 className="text-white/50 text-[10px] font-black uppercase tracking-[0.2em] px-2 mb-1">App Guide</h3>
                    <div className="flex flex-col rounded-[24px] bg-surface-dark overflow-hidden border border-white/5 shadow-xl">
                        <button
                            onClick={() => {
                                localStorage.setItem('app_tour_step', 'profile_pending');
                                safeNavigate('/profile');
                            }}
                            className="flex w-full items-center justify-between p-4 px-5 active:bg-white/5 transition-colors text-left group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/60 group-hover:text-primary transition-colors">
                                    <Icon name="explore" />
                                </div>
                                <span className="text-sm font-bold">Restart App Demo</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black bg-white/5 text-white/40 px-3 py-1 rounded-full uppercase tracking-widest">
                                    Guided Tour
                                </span>
                                <Icon name="play_arrow" className="text-white/20" />
                            </div>
                        </button>
                    </div>
                </div>

                {/* Sign Out Button */}
                <button
                    onClick={async () => {
                        console.log('isLoggingOut', isLoggingOut);
                        if (isLoggingOut) return;
                        console.log('Logging out...');
                        setIsLoggingOut(true);
                        try {
                            await logout();
                            console.log('Logged out successfully');
                            safeNavigate('/');
                        } catch (error) {
                            console.error('Logout failed:', error);
                            setIsLoggingOut(false);
                        }
                    }}
                    disabled={isLoggingOut}
                    className={`mt-4 flex w-full items-center justify-center rounded-xl p-4 border transition-all gap-2 ${
                        isLoggingOut 
                        ? "bg-white/5 border-white/10 text-white/30 cursor-not-allowed" 
                        : "bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 text-red-400 border-red-500/20 active:scale-[0.98]"
                    }`}
                >
                    {isLoggingOut ? (
                        <>
                            <Icon name="progress_activity" className="text-[20px] animate-spin" />
                            <span className="text-sm font-bold">Signing Out...</span>
                        </>
                    ) : (
                        <>
                            <Icon name="logout" className="text-[20px]" />
                            <span className="text-sm font-bold">Sign Out</span>
                        </>
                    )}
                </button>

                <div className="mt-8 text-center">
                    <p className="text-white/20 text-xs">FireConnect v1.0.0</p>
                </div>
            </main>
        </div>
    );
};

export default Settings;
