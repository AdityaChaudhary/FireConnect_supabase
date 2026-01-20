import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import Discover from './screens/Discover';
import Matches from './screens/Matches';
import ChatList from './screens/ChatList';
import Profile from './screens/Profile';
import EditProfile from './screens/EditProfile';
import ChatDetail from './screens/ChatDetail';
import Auth from './screens/Auth';
import Onboarding from './screens/Onboarding';
import Settings from './screens/Settings';
import Subscription from './screens/Subscription';
import SubscriptionWelcome from './screens/SubscriptionWelcome';
import Notifications from './screens/Notifications';
import Landing from './screens/Landing';
import PurchaseCredits from './screens/PurchaseCredits';
import ProfilePreview from './screens/ProfilePreview';
import RandomChat from './screens/RandomChat';
import { AuthProvider, useAuth } from './context/AuthContext';
import CreditsWelcome from './screens/CreditsWelcome';
import SpyList from './screens/SpyList';
import Policy from './screens/Policy';
import { useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import OnlineStatusTracker from './components/OnlineStatusTracker';
import ScrollToTop from './components/ScrollToTop';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const AppRoutes: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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

  console.log("AppRoutes: State", { loading, hasUser: !!user, hasProfile: !!profile });

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-background-dark flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
        <p className="text-white/30 text-xs font-bold tracking-widest uppercase animate-pulse">Initializing Session</p>
      </div>
    );
  }

  if (!user) {
    console.log("AppRoutes: No user, showing Landing");
    return <Landing />;
  }

  if (!profile || !profile.username || !profile.display_name || !profile.gender || !profile.date_of_birth || !profile.location) {
    return <Onboarding />;
  }

  return (
    <>
      <ScrollToTop />
      <Layout>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="flex-1 flex flex-col min-h-screen"
        >
          <Routes location={location}>
            <Route path="/" element={<Discover />} />
            <Route path="/landing" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/matches" element={<Matches />} />
            <Route path="/chat" element={<ChatList />} />
            <Route path="/chat/:id" element={<ChatDetail />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/edit" element={<EditProfile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/welcome" element={<SubscriptionWelcome />} />
            <Route path="/credits-welcome" element={<CreditsWelcome />} />
            <Route path="/profile/:id" element={<ProfilePreview />} />
            <Route path="/purchase-credits" element={<PurchaseCredits />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/random-chat" element={<RandomChat />} />
            <Route path="/spy-list" element={<SpyList />} />
            <Route path="/settings/privacy" element={<Policy />} />
            <Route path="/settings/terms" element={<Policy />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
      </Layout>
    </>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OnlineStatusTracker />
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
