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

                // Fetch real-time subscription from Stripe Wrapper
                console.log("AuthContext: Fetching subscription for", currentUser.id);
                const { data: subData, error: subError } = await supabase.rpc('get_subscription_info', {
                    user_id: currentUser.id
                });

                if (subError) {
                    console.error("AuthContext: Error fetching subscription:", subError);
                    setStripeRole(data?.stripe_role?.toLowerCase() || 'free');
                    setSubscription(null);
                } else {
                    const activeSub = subData && subData.length > 0 ? subData[0] : null;
                    console.log("AuthContext: Subscription details:", activeSub);
                    setSubscription(activeSub);
                    if (activeSub && activeSub.status === 'active') {
                        setStripeRole(activeSub.role?.toLowerCase() || 'free');
                    } else {
                        setStripeRole('free');
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
                    // Start profile refresh in background, don't await to avoid blocking UI
                    refreshProfile(initialSession.user);
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
