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
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [stripeRole, setStripeRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshProfile = async () => {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', currentUser.id)
                    .single();

                if (error) throw error;

                setProfile(data as Profile);
                setStripeRole(data?.stripe_role?.toLowerCase() || 'free');
            } catch (err) {
                console.error("Error refreshing profile:", err);
            }
        }
    };

    useEffect(() => {
        // Handle initial session
        supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
            setSession(initialSession);
            setUser(initialSession?.user ?? null);
            if (initialSession?.user) {
                refreshProfile();
            } else {
                setLoading(false);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
            setSession(currentSession);
            setUser(currentSession?.user ?? null);

            if (currentSession?.user) {
                await refreshProfile();
            } else {
                setProfile(null);
                setStripeRole(null);
            }
            setLoading(false);
        });

        return () => {
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
