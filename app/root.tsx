import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  data,
  isRouteErrorResponse,
} from "react-router";
import type { Route } from "./+types/root";
import type { MetaFunction } from "react-router";
import { Analytics } from "@vercel/analytics/react";
import { createSupabaseServerClient } from "../lib/supabase.server";
import { trackEvent, EVENTS } from "./lib/analytics";
import "./tailwind.css";

export const meta: MetaFunction = () => {
  const baseUrl = "https://fireconnect.me";
  const imageUrl = `${baseUrl}/fireconnect-og-image.png?v=1`;

  return [
    { title: "FireConnect - Adult Chat, Dirty Chat & Intimate Connections" },
    { name: "description", content: "The most exclusive network for verified adults. Experience online intimacy, private adult chat, and sexting with strangers. Join FireConnect for uninhibited connection." },
    { name: "theme-color", content: "#22101a" },
    { property: "og:title", content: "FireConnect - Exclusive Network for Adults. Intimacy all the way!" },
    { property: "og:description", content: "Experience online intimacy, privacy, and uninhibited connection. Chat with strangers, explore private vaults and share intimate moments." },
    { property: "og:type", content: "website" },
    { property: "og:url", content: baseUrl },
    { property: "og:image", content: imageUrl },
    { property: "og:image:secure_url", content: imageUrl },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: "FireConnect - Exclusive Network for Adults. Intimacy all the way!" },
    { name: "twitter:description", content: "Experience online intimacy, privacy, and uninhibited connection." },
    { name: "twitter:image", content: imageUrl },
  ];
};
import { AuthProvider, useAuth } from "../context/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import OnlineStatusTracker from "../components/OnlineStatusTracker";
import ScrollToTop from "../components/ScrollToTop";
import MainLayout from "../Layout";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import Onboarding from "../screens/Onboarding";
import NavigationProgress from "../components/NavigationProgress";

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, responseHeaders } = createSupabaseServerClient(request);
  
  // Get both user and session for robust hydration
  let authUser = null;
  let authSession = null;

  try {
    // Optimization: Only call getUser() which validates the token on the server.
    // getSession() is redundant if we have getUser(), and getUser is more secure suitable for SSR protection.
    const { data: { user } } = await supabase.auth.getUser();
    authUser = user;
    
    // We don't strictly need the full session object here for the loader data 
    // if the client SDK handles session recovery, but for hydration we can pass the user.
  } catch (e) {
    console.warn("Root loader: Auth check failed", e);
  }
  
  let profile = null;


  if (authUser) {
    const { data: profileData } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();
    profile = profileData;
  }

  // Ensure values are null if not found (for consistent serialization)
  return data({ 
    session: authSession || null, 
    user: authUser || null, 
    profile: profile || null,
    initialThreads: null // Optimized: Fetched on demand via RPC in ChatList
  }, { headers: responseHeaders });
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning={true}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover" />
        <Meta />
        <Links />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/fireconnect-logo-192x192.png" />
        {/* Preconnect to Font Servers */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-ZJT8X5JK2T"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());

              gtag('config', 'G-ZJT8X5JK2T');
            `,
          }}
        />
        
        {/* Preload Fonts */}
        <link
            rel="preload"
            href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
            as="style"
        />
        <link
            rel="preload"
            href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap"
            as="style"
        />
        <link
            rel="preload"
            href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
            as="style"
        />

        <link
            href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
            rel="stylesheet"
        />
        <link
            href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap"
            rel="stylesheet"
        />
        <link
            href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
            rel="stylesheet"
        />
      </head>
      <body>
        <NavigationProgress />
        {children}
        {typeof window !== "undefined" && <Analytics />}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

import { useAppTour } from "../hooks/useAppTour";
 
function AppContent() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useAppTour();

  console.log("AppContent: Render", { 
    path: location.pathname, 
    userId: user?.id, 
    hasProfile: !!profile, 
    loading 
  });

  const isAuthPage = location.pathname === '/' || location.pathname === '/auth';
  const isPolicyPage = location.pathname === '/privacy' || location.pathname === '/terms' || location.pathname.startsWith('/settings/');
  const isBlogPage = location.pathname.startsWith('/blog') || location.pathname.startsWith('/compare');
  const isProfileComplete = !!(profile && 
    profile.username && 
    profile.display_name && 
    profile.gender && 
    profile.date_of_birth && 
    profile.location);

  useEffect(() => {
    if (loading) return;

    // Track page views
    trackEvent(EVENTS.PAGE_VIEW, { path: location.pathname });

    // Handle session intent and redirection for authenticated users
    if (user && isProfileComplete) {
      const intent = localStorage.getItem('auth_intent');
      if (intent) {
        try {
          const { type, id } = JSON.parse(intent);
          if (type === 'profile' && id) {
            localStorage.removeItem('auth_intent');
            navigate(`/profile/${id}`);
            return;
          } else if (type === 'subscription') {
            localStorage.removeItem('auth_intent');
            navigate('/subscription');
            return;
          }
        } catch (e) {
          console.error("Error parsing auth_intent", e);
          localStorage.removeItem('auth_intent');
        }
      }

      const justOnboarded = localStorage.getItem('just_onboarded');
      if (justOnboarded === 'true') {
        localStorage.removeItem('just_onboarded');
        localStorage.setItem('app_tour_step', 'profile_pending');
        navigate('/profile');
        return;
      }

      if (location.pathname === '/auth') {
        navigate('/');
        return;
      }
    }

    // Handle unauthenticated user redirection
    if (!user && !isPolicyPage && !isAuthPage && !isBlogPage) {
      console.log("AppContent: No user, redirecting to / via useEffect");
      navigate('/', { replace: true });
    }
  }, [user, profile, loading, navigate, location.pathname, isProfileComplete, isPolicyPage, isAuthPage, isBlogPage]);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-background-dark flex flex-col items-center justify-center gap-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none"></div>
        <div className="flex items-center justify-center size-16 bg-gradient-to-tr from-fire-pink to-neon-purple rounded-2xl shadow-[0_0_30px_rgba(255,0,85,0.4)] animate-pulse">
          <span className="material-symbols-outlined text-4xl text-white">local_fire_department</span>
        </div>
        <div className="flex flex-col items-center gap-2">
            <h1 className="text-2xl font-black tracking-tighter text-white uppercase"><span className="text-transparent bg-clip-text bg-gradient-to-r from-fire-pink to-neon-purple">Fire</span>Connect</h1>
            <p className="text-white/30 text-xs font-bold tracking-[0.3em] uppercase animate-pulse">Initializing Session</p>
        </div>
      </div>
    );
  }

  // Onboarding Logic (Conditional render is safe)
  // if (user && !isProfileComplete && !isPolicyPage && !isAuthPage) {
  //fix for onboarding not showing
  if (user && !isProfileComplete && !isPolicyPage) {
    console.log("AppContent: Profile incomplete, showing Onboarding");
    return <Onboarding />;
  }

  return (
    <MainLayout>
      <Outlet />
    </MainLayout>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  const { session, user, profile } = loaderData;
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider 
        initialSession={session} 
        initialUser={user} 
        initialProfile={profile}
        initialThreads={loaderData.initialThreads}
      >
        <OnlineStatusTracker />
        <ScrollToTop />
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
