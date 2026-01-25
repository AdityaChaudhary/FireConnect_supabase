import React from 'react';
import type { MetaFunction } from "react-router";
import { useAuth } from '../context/AuthContext';
import { useLoaderData } from 'react-router';
import Landing from './Landing';
import Discover from './Discover';
import { createSupabaseServerClient } from '../lib/supabase.server';
import type { Route } from './+types/Home';

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    if (!data?.user) {
        return [
            { title: "FireConnect - Adult Chat, Dirty Chat & Intimate Connections" },
            { name: "description", content: "The most exclusive network for verified adults. Experience luxury, privacy, and adult chat with strangers. Join FireConnect for sexting and uninhibited connection." },
            { property: "og:title", content: "FireConnect - Exclusive Network for Adults. Intimacy all the way!" },
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
    // Optimization: Use getSession() to avoid external API call.
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    const url = new URL(request.url);
    const isAuthCallback = url.searchParams.has('code');

    if (!user) {
        // Fetch plans and AI users on client side only for better SSR performance
        return {
            user: null,
            isAuthCallback
        };
    }

    // If logged in, we return the user
    return {
        user,
        isAuthCallback
    };
}

const Home: React.FC = () => {
    const { user, profile, loading } = useAuth();

    // While initializing session, show nothing or a minimal splash
    // (root.tsx already has a loading state in AppContent)
    // Also check for code in URL to avoid Landing flicker during hydration
    const data = useLoaderData<typeof loader>();

    // While initializing session, show nothing or a minimal splash
    // (root.tsx already has a loading state in AppContent)
    // We check for code in URL via loader data to ensure hydration match
    // This prevents the Landing page from flashing before auth completes

    if (loading || (!user && data?.isAuthCallback)) {
        return null;
    }

    if (user && profile) {
        return <Discover />;
    }

    return <Landing />;
};

export default Home;
