import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from "react-router";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import OnlineStatusTracker from "../components/OnlineStatusTracker";
import ScrollToTop from "../components/ScrollToTop";
import MainLayout from "../Layout";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover" />
        <Meta />
        <Links />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="shortcut icon" href="/favicon.ico" />
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
        <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
        <script dangerouslySetInnerHTML={{ __html: `
            tailwind.config = {
                darkMode: "class",
                theme: {
                    extend: {
                        colors: {
                            "primary": "rgba(var(--primary-rgb), <alpha-value>)",
                            "neon-purple": "#bc13ec",
                            "fire-pink": "#ff0055",
                            "charcoal": "#0f0f11",
                            "charcoal-light": "#1a1a1d",
                            "glass": "rgba(255, 255, 255, 0.03)",
                            "background-light": "#f8f6f7",
                            "background-dark": "rgba(var(--background-dark-rgb), <alpha-value>)",
                            "surface-dark": "rgba(var(--surface-dark-rgb), <alpha-value>)",
                            "bubble-incoming": "#2a2a2a",
                            "text-secondary": "#c992b2",
                        },
                        fontFamily: {
                            "sans": ["var(--font-sans)", "sans-serif"],
                            "display": ["var(--font-display)", "sans-serif"],
                        },
                        borderRadius: {
                            "DEFAULT": "1rem",
                            "lg": "1.5rem",
                            "xl": "2rem",
                            "2xl": "3rem",
                            "4xl": "2.5rem",
                            "5xl": "3rem",
                            "super": "40px",
                            "full": "9999px",
                        },
                        backgroundImage: {
                            "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
                        },
                        animation: {
                            "scan": "scan 3s ease-in-out infinite",
                            "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                        },
                        keyframes: {
                            scan: {
                                "0%, 100%": { top: "0%" },
                                "50%": { top: "100%" },
                            },
                        },
                    },
                },
            };
        `}} />
        <style dangerouslySetInnerHTML={{ __html: `
            :root {
                scrollbar-gutter: stable;
                --primary: #ec1392;
                --background-dark: #22101a;
                --surface-dark: #2d1623;
                --font-sans: "Plus Jakarta Sans";
                --font-display: "Plus Jakarta Sans";
                --primary-rgb: 236, 19, 146;
                --background-dark-rgb: 34, 16, 26;
                --surface-dark-rgb: 45, 22, 35;
            }

            .landing-theme {
                --primary: #a413ec;
                --background-dark: #0f0f11;
                --surface-dark: #1a1a1d;
                --font-sans: "Outfit";
                --font-display: "Outfit";
                --primary-rgb: 164, 19, 236;
                --background-dark-rgb: 15, 15, 17;
                --surface-dark-rgb: 26, 26, 29;
            }

            body {
                font-family: var(--font-sans), sans-serif;
                background-color: var(--background-dark);
                color: white;
                min-height: 100vh;
            }

            .text-glow { text-shadow: 0 0 20px rgba(var(--primary-rgb), 0.6); }
            .text-glow-pink { text-shadow: 0 0 20px rgba(255, 0, 85, 0.6); }
            .btn-glow { box-shadow: 0 0 20px rgba(var(--primary-rgb), 0.4); transition: all 0.3s ease; }
            .btn-glow:hover { box-shadow: 0 0 30px rgba(var(--primary-rgb), 0.7); transform: translateY(-2px); }
            .glass-card { background: rgba(30, 30, 35, 0.4); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.08); }
            .glass-panel { background: linear-gradient(145deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.05); }
            .hide-scrollbar::-webkit-scrollbar { display: none; }
            .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            ::-webkit-scrollbar { width: 6px; height: 6px; }
            ::-webkit-scrollbar-track { background: transparent; }
            ::-webkit-scrollbar-thumb { background: linear-gradient(to bottom, var(--primary), #ff0055); border-radius: 10px; opacity: 0.5; }
            ::-webkit-scrollbar-thumb:hover { background: linear-gradient(to bottom, var(--primary), #ff0055); opacity: 1; }
            * { scrollbar-width: thin; scrollbar-color: var(--primary) transparent; }
            .glass-nav { background: rgba(var(--background-dark-rgb), 0.8); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
            .material-symbols-outlined.filled { font-variation-settings: "FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24; }
        `}} />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function AppContent() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  console.log("AppContent: Render", { 
    path: location.pathname, 
    userId: user?.id, 
    hasProfile: !!profile, 
    loading 
  });

  useEffect(() => {
    if (user && profile && profile.username && profile.display_name && profile.gender && profile.date_of_birth && profile.location) {
      const intent = localStorage.getItem('auth_intent');
      if (intent) {
        try {
          const { type, id } = JSON.parse(intent);
          if (type === 'profile' && id) {
            localStorage.removeItem('auth_intent');
            navigate(`/profile/${id}`);
          } else if (type === 'subscription') {
            localStorage.removeItem('auth_intent');
            navigate('/subscription');
          }
        } catch (e) {
          console.error("Error parsing auth_intent", e);
          localStorage.removeItem('auth_intent');
        }
      } else {
        const justOnboarded = localStorage.getItem('just_onboarded');
        if (justOnboarded === 'true') {
          localStorage.removeItem('just_onboarded');
          navigate('/profile');
        } else if (location.pathname === '/landing' || location.pathname === '/auth') {
          navigate('/');
        }
      }
    }
  }, [user, profile, navigate, location.pathname]);

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

  const isAuthPage = location.pathname === '/landing' || location.pathname === '/auth';
  const isPolicyPage = location.pathname === '/privacy' || location.pathname === '/terms' || location.pathname.startsWith('/settings/');

  // If loading, the initialization screen is shown above.
  
  // If not logged in and not on an allowed page, redirect to Landing
  if (!loading && !user && !isPolicyPage && !isAuthPage && location.pathname !== '/landing') {
    console.log("AppContent: No user, redirecting to /landing");
    navigate('/landing', { replace: true });
    return null;
  }

  console.log("AppContent: Rendering MainLayout with Outlet", { path: location.pathname });

  return (
    <MainLayout>
      <Outlet />
    </MainLayout>
  );
}

export default function App() {
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
      <AuthProvider>
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
