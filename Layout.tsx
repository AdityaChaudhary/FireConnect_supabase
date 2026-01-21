import React from 'react';
import { useLocation } from 'react-router';
import BottomNav from './components/BottomNav';
import { useAuth } from './context/AuthContext';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { user } = useAuth();
    const location = useLocation();
    // Hide bottom nav on specific pages
    const hideOn = ['/welcome', '/credits-welcome', '/notifications', '/settings/privacy', '/settings/terms', '/privacy', '/terms'];
    const showBottomNav = !location.pathname.startsWith('/chat/') &&
        !location.pathname.startsWith('/profile/') &&
        !hideOn.includes(location.pathname) &&
        location.pathname !== '/landing';

    return (
        <div className="bg-background-dark min-h-screen font-display">
            <div className={`${location.pathname === '/landing' || location.pathname.startsWith('/chat/') || !user ? '' : 'max-w-md mx-auto'} min-h-[100dvh] relative bg-background-dark overflow-x-hidden`}>
                {children}
            </div>
            {showBottomNav && <BottomNav />}
        </div>
    );
};

export default Layout;
