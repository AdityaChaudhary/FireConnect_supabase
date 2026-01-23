import React from 'react';
import { useLocation } from 'react-router';
import Sidebar from './components/Sidebar';
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
    const showNav = !location.pathname.startsWith('/chat/') &&
        !location.pathname.startsWith('/profile/') &&
        !location.pathname.startsWith('/blog') &&
        !location.pathname.startsWith('/compare') &&
        !hideOn.includes(location.pathname) &&
        (location.pathname !== '/' || user);

    // On desktop, we show the sidebar if we are not on the landing page/auth
    const showSidebar = showNav;
    const showBottomNav = showNav;

    return (
        <div className="bg-background-dark min-h-screen font-display lg:flex">
            {showSidebar && <Sidebar />}
            
            <main className={`flex-1 min-h-[100dvh] relative bg-background-dark overflow-x-hidden transition-all duration-300
                ${(location.pathname === '/' && !user) || location.pathname.startsWith('/chat/') || !user 
                    ? 'w-full' 
                    : 'w-full lg:max-w-none lg:mx-0'}`}>
                {children}
            </main>

            {showBottomNav && (
                <div className="lg:hidden">
                    <BottomNav />
                </div>
            )}
        </div>
    );
};

export default Layout;
