import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface Profile {
    id: string;
    username: string;
    email: string;
    display_name?: string;
    bio?: string;
    gender?: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    date_of_birth?: string;
    interests?: string[];
    is_onboarded?: boolean;
    user_type?: 'HUMAN' | 'AI';
    stripe_role?: 'FREE' | 'PRO' | 'MAX';
    spy_credits?: number;
    created_at?: string;
    updated_at?: string;
    profile_picture_url?: string;
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    profile: Profile | null;
    stripeRole: string | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    subscription: any | null;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [stripeRole, setStripeRole] = useState<string | null>(null);
    const [subscription, setSubscription] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshProfile = async (specificUser?: User) => {
        let currentUser = specificUser;

        if (!currentUser) {
            const { data } = await supabase.auth.getSession();
            currentUser = data.session?.user;
        }

        if (currentUser) {
            console.log("AuthContext: Refreshing profile for", currentUser.id);
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', currentUser.id)
                    .single();

                if (error) {
                    console.warn("AuthContext: Profile fetch result:", error.code, error.message);
                    setProfile(null);
                    return;
                }

                console.log("AuthContext: Profile loaded", data?.username || "no username");
                setProfile(data as Profile);

                // Immediately set stripeRole from profile cache to avoid jitter
                if (data?.stripe_role) {
                    console.log("AuthContext: Setting stripeRole from profile cache:", data.stripe_role);
                    setStripeRole(data.stripe_role.toLowerCase());
                }

                // Fetch real-time subscription from Stripe Wrapper in background
                console.log("AuthContext: Fetching subscription for", currentUser.id);
                const { data: subData, error: subError } = await supabase.rpc('get_subscription_info', {
                    user_id: currentUser.id
                });

                if (subError) {
                    console.error("AuthContext: Error fetching subscription:", subError);
                    // Fallback to profile role which we already set
                    if (!data?.stripe_role) setStripeRole('free');
                    setSubscription(null);
                } else {
                    const activeSub = subData && subData.length > 0 ? subData[0] : null;
                    console.log("AuthContext: Subscription details:", activeSub);
                    setSubscription(activeSub);
                    if (activeSub && activeSub.status === 'active') {
                        const newRole = activeSub.role?.toLowerCase() || 'free';
                        setStripeRole(newRole);
                        
                        // If cached role is different, update it silently in background
                        if (data?.stripe_role?.toLowerCase() !== newRole) {
                            console.log("AuthContext: Syncing cache... cache:", data?.stripe_role, "real:", newRole);
                            supabase.from('users').update({ stripe_role: newRole.toUpperCase() }).eq('id', currentUser.id).then();
                        }
                    } else {
                        setStripeRole('free');
                        if (data?.stripe_role !== 'FREE') {
                            supabase.from('users').update({ stripe_role: 'FREE' }).eq('id', currentUser.id).then();
                        }
                    }
                }

            } catch (err) {
                console.error("AuthContext: Error in refreshProfile fetch:", err);
            }
        } else {
            console.log("AuthContext: No user available to refresh profile");
        }
    };

    useEffect(() => {
        console.log("AuthContext: Initializing...");

        let isMounted = true;

        const initializeAuth = async () => {
            try {
                console.log("AuthContext: Fetching initial session...");
                const { data: { session: initialSession } } = await supabase.auth.getSession();
                console.log("AuthContext: Initial session fetch result:", initialSession ? "Session found" : "No session");

                if (!isMounted) return;

                if (initialSession) {
                    setSession(initialSession);
                    setUser(initialSession.user);
                    // Await profile refresh on first load to prevent flash of "FREE" status
                    await refreshProfile(initialSession.user);
                }
            } catch (err) {
                console.error("AuthContext: Error during initialization:", err);
            } finally {
                if (isMounted) {
                    setLoading(false);
                    console.log("AuthContext: Initial load complete, loading=false");
                }
            }
        };

        initializeAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            console.log("AuthContext: onAuthStateChange event:", event, currentSession ? "Session active" : "No session");

            if (!isMounted) return;

            setSession(currentSession);
            setUser(currentSession?.user ?? null);

            if (currentSession?.user) {
                // Don't await here either; let the app react to user presence first
                refreshProfile(currentSession.user);
            } else {
                setProfile(null);
                setStripeRole(null);
                setSubscription(null);
            }

            setLoading(false);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // Heartbeat for online status
    useEffect(() => {
        if (!user) return;

        const heartbeat = async () => {
            try {
                await supabase
                    .from('user_online_status')
                    .upsert({ 
                        user_id: user.id, 
                        last_seen_at: new Date().toISOString() 
                    });
            } catch (err) {
                console.error("AuthContext: Heartbeat error:", err);
            }
        };

        heartbeat(); // Run immediately
        const interval = setInterval(heartbeat, 30000); // Every 30 seconds

        return () => clearInterval(interval);
    }, [user]);

    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) throw error;
    };

    const logout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    };

    return (
        <AuthContext.Provider value={{
            user,
            session,
            profile,
            stripeRole,
            subscription,
            loading,
            signInWithGoogle,
            logout,
            refreshProfile
        }}>
            {children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
