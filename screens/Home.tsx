import React from 'react';
import type { MetaFunction } from "react-router";
import { useAuth } from '../context/AuthContext';
import { useLoaderData } from 'react-router';
import Landing from './Landing';
import Discover from './Discover';
import { createSupabaseServerClient } from '../lib/supabase.server';
import { getStripeProducts } from '../lib/stripe-utils';
import type { Route } from './+types/Home';

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    if (!data?.user) {
        return [
            { title: "FireConnect - Adult Chat, Dirty Chat & Intimate Connections" },
            { name: "description", content: "The most exclusive network for verified adults. Experience luxury, privacy, and adult chat with strangers. Join FireConnect for sexting and uninhibited connection." },
            { property: "og:title", content: "FireConnect - Adult Chat & Sexting" },
            { property: "og:description", content: "The most exclusive network for verified adults. Join FireConnect for dirty chat and intimate connections." },
            { property: "og:type", content: "website" },
        ];
    }
    return [
        { title: "Discover People Nearby | FireConnect" },
        { name: "description", content: "Explore verified profiles and discover intimate connections near you." },
        { property: "og:title", content: "Discover People Nearby | FireConnect" },
        { property: "og:description", content: "Explore verified profiles and discover intimate connections near you." },
    ];
};

export async function loader({ request }: Route.LoaderArgs) {
    const { supabase } = createSupabaseServerClient(request);
    
    // Check auth status
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        // Fetch plans and AI users in parallel for SSR Landing page
        const [products, aiUsersRes] = await Promise.all([
            getStripeProducts(supabase),
            supabase
                .from('users')
                .select('*, user_online_status(*)')
                .eq('user_type', 'AI')
                .order('created_at', { ascending: false })
                .limit(20)
        ]);

        return {
            user: null,
            initialProducts: products || [],
            initialAiUsers: aiUsersRes.data || []
        };
    }

    // If logged in, we return the user and empty landing data
    return {
        user,
        initialProducts: [],
        initialAiUsers: []
    };
}

const Home: React.FC = () => {
    const { user, profile, loading } = useAuth();

    // While initializing session, show nothing or a minimal splash
    // (root.tsx already has a loading state in AppContent)
    // Also check for code in URL to avoid Landing flicker during hydration
    const hasCode = typeof window !== 'undefined' && window.location.search.includes('code=');

    if (loading || hasCode) {
        return null;
    }

    const data = useLoaderData<typeof loader>();

    if (user && profile) {
        return <Discover />;
    }

    return <Landing initialProducts={data.initialProducts} initialAiUsers={data.initialAiUsers} />;
};

export default Home;
