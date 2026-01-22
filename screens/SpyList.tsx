import React from 'react';
import { useLoaderData } from 'react-router';
import { useSafeNavigate } from '../hooks/useSafeNavigate';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';

import { createSupabaseServerClient } from '../lib/supabase.server';
import CdnImage from '../components/CdnImage';
import { useSpiedProfiles } from '../hooks/useData';
import type { Route } from './+types/SpyList';

export async function loader({ request }: Route.LoaderArgs) {
    const { supabase } = createSupabaseServerClient(request);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { spiedProfiles: [] };

    const { data, error } = await supabase
        .from('spied_profiles')
        .select(`
            target_user_id,
            created_at,
            target:users!target_user_id (
                id,
                display_name,
                username,
                profile_picture_url,
                gender,
                location,
                bio
            )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return { spiedProfiles: data || [] };
}

const SpyList: React.FC = () => {
    const { user } = useAuth();
    const loaderData = useLoaderData<typeof loader>();
    const { safeNavigate, safeBack } = useSafeNavigate();

    const { data: spiedProfiles = [], isLoading: loading } = useSpiedProfiles(user?.id, loaderData?.spiedProfiles);



    return (
        <div className="relative flex min-h-screen w-full flex-col overflow-hidden pb-24 text-white bg-background-dark">
            <header className="sticky top-0 z-20 flex w-full items-center gap-4 bg-background-dark/80 px-4 py-4 backdrop-blur-md border-b border-white/5">
                <button
                    onClick={() => safeBack()}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-dark text-white hover:bg-white/10 active:scale-95 transition-all"
                >
                    <Icon name="arrow_back" />
                </button>
                <h1 className="text-xl font-bold tracking-tight">My Spy List</h1>
            </header>

            <main className="flex-1 px-4 py-6 w-full max-w-md mx-auto">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                    </div>
                ) : spiedProfiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                            <Icon name="visibility_off" className="text-4xl text-white/10" />
                        </div>
                        <h2 className="text-lg font-bold text-white mb-2">No spied profiles</h2>
                        <p className="text-sm text-white/40 leading-relaxed px-10">
                            Profiles you've used your "Spy Credits" on will appear here.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {spiedProfiles.map((item) => {
                            const profile = item.target;
                            if (!profile) return null;
                            
                            return (
                                <div
                                    key={profile.id}
                                    onClick={() => safeNavigate(`/profile/${profile.id}`)}
                                    className="flex items-center gap-4 p-4 rounded-2xl bg-surface-dark border border-white/5 hover:border-primary/30 active:scale-[0.98] transition-all cursor-pointer group"
                                >
                                    <div className="h-16 w-16 rounded-xl overflow-hidden bg-background-dark border border-white/10 relative">
                                        <CdnImage
                                            path={profile.profile_picture_url}
                                            gender={profile.gender}
                                            seed={profile.id}
                                            className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-base font-bold text-white truncate group-hover:text-primary transition-colors">
                                            {profile.display_name || profile.username || 'User'}
                                        </h3>
                                        <p className="text-xs text-white/40 truncate mt-0.5">
                                            {profile.location || 'Nearby'}
                                        </p>
                                        <p className="text-[10px] text-primary/60 font-medium uppercase tracking-wider mt-1.5 flex items-center gap-1">
                                            <Icon name="history" className="text-[12px]" />
                                            Spied on {new Date(item.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <Icon name="chevron_right" className="text-white/20" />
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
};

export default SpyList;
