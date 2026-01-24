import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.client';
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
    initialThreads: any[] | null;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

interface AuthProviderProps {
    children: React.ReactNode;
    initialSession?: Session | null;
    initialUser?: User | null;
    initialProfile?: Profile | null;
    initialThreads?: any[] | null;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, initialSession, initialUser, initialProfile, initialThreads }) => {
    const [user, setUser] = useState<User | null>(initialUser ?? initialSession?.user ?? null);
    const [session, setSession] = useState<Session | null>(initialSession ?? null);
    const [profile, setProfile] = useState<Profile | null>(initialProfile ?? null);
    const [stripeRole, setStripeRole] = useState<string | null>(initialProfile?.stripe_role?.toLowerCase() ?? null);
    const [subscription, setSubscription] = useState<any | null>(null);
    const [loading, setLoading] = useState(() => {
        // If we are on the server, we're not loading (loaders already ran)
        if (typeof window === 'undefined') return false;
        
        // If we have a user but no profile was passed, we might still be loading it on the client
        if (initialUser && initialProfile === undefined) return true;
        
        // If we have explicit results from loader (even if null), we can stop loading
        if (initialUser !== undefined || initialSession !== undefined) return false;
        
        return true;
    });

    const refreshProfile = async (specificUser?: User | null) => {
        let currentUser = specificUser || null;

        if (!currentUser) {
            const { data } = await supabase.auth.getUser();
            currentUser = data.user;
        }

        if (currentUser) {
            console.log("AuthContext: Refreshing profile for", currentUser.id);
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', currentUser.id)
                    .maybeSingle();

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
                console.log("AuthContext: Fetching session from cookie/storage...");
                // Fetch session first (quickest, often local/cookie only)
                const { data: { session: initialSession } } = await supabase.auth.getSession();
                
                if (!isMounted) return;

                if (initialSession) {
                    setSession(initialSession);
                    setUser(initialSession.user);
                    
                    // Now verify user with server (might 403 if token is invalid or local only)
                    try {
                        const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser();
                        if (!userError && verifiedUser) {
                            setUser(verifiedUser);
                        }
                    } catch (e) {
                        console.warn("AuthContext: getUser failed during initialization, sticking with session user", e);
                    }

                    console.log("AuthContext: Initial session found, refreshing profile...");
                    await refreshProfile(initialSession.user);
                    console.log("AuthContext: Profile refreshed.");
                } else {
                    console.log("AuthContext: No initial session found.");
                }
            } catch (err) {
                console.error("AuthContext: Error during initialization:", err);
            } finally {
                if (isMounted) {
                    console.log("AuthContext: Setting loading to false.");
                    setLoading(false);
                }
            }
        };

        if (!(initialUser || initialSession)) {
            initializeAuth();
        } else {
            console.log("AuthContext: Hydrated from initial user/session.");
            const hydrateProfile = async () => {
                const currentUser = initialUser || initialSession?.user;
                if (currentUser) {
                    // Even if hydrated, we should still fetch profile/subscription info to be safe and fresh
                    await refreshProfile(currentUser);
                }
                if (isMounted) {
                    setLoading(false);
                }
            };
            hydrateProfile();
        }

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            // Ignore token refresh events to prevent unnecessary profile re-fetching
            if (event === 'TOKEN_REFRESHED') {
                console.log("AuthContext: Token refreshed, skipping profile refresh.");
                if (currentSession) setSession(currentSession);
                return;
            }
            
            console.log("AuthContext: onAuthStateChange event:", event, currentSession ? "Session active" : "No session");

            if (!isMounted) return;

            setSession(currentSession);
            // Validation step for security: double check user if event is SIGNED_IN or INITIAL_SESSION
            if (currentSession?.user) {
                // For SIGNED_IN, we want to be sure we have the latest user data
                if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                    const { data: { user: verifiedUser } } = await supabase.auth.getUser();
                    setUser(verifiedUser ?? currentSession.user);
                    refreshProfile(verifiedUser ?? currentSession.user);
                } else {
                    setUser(currentSession.user);
                }
            } else {
                setUser(null);
                setProfile(null);
                setStripeRole(null);
                setSubscription(null);
            }
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
                redirectTo: `${window.location.origin}/auth/callback`
            }
        });
        if (error) throw error;
    };

    const logout = async () => {
        console.log("AuthContext: Logging out...");

        // Fire global signout in background (best effort)
        supabase.auth.signOut({ scope: 'global' }).catch(err => {
            console.error("AuthContext: Global signout background error:", err);
        });

        // Race condition: specific local signout vs timeout
        // This prevents the button from spinning forever if the network/client is unresponsive
        const localSignOutPromise = supabase.auth.signOut({ scope: 'local' });
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({ error: null, timeout: true }), 2000));

        try {
            await Promise.race([localSignOutPromise, timeoutPromise]);
            console.log("AuthContext: Logout completed (or timed out).");
        } catch (error) {
            console.error("AuthContext: Logout error:", error);
        } finally {
            // Force clear state regardless of what happened
            setUser(null);
            setSession(null);
            setProfile(null);
            setStripeRole(null);
            setSubscription(null);
            // Optional: force reload to clear any lingering in-memory state if needed
            // window.location.reload(); 
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            session,
            profile,
            stripeRole,
            subscription,
            loading,
            initialThreads: initialThreads ?? null,
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
