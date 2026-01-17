import React from 'react';
import { useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const location = useLocation();
    // Hide bottom nav on specific pages
    const hideOn = ['/welcome', '/credits-welcome', '/notifications'];
    const showBottomNav = !location.pathname.startsWith('/chat/') &&
        !location.pathname.startsWith('/profile/') &&
        !hideOn.includes(location.pathname) &&
        location.pathname !== '/landing';

    return (
        <div className="bg-background-dark min-h-screen font-display">
            <div className="max-w-md mx-auto min-h-screen relative bg-background-dark">
                {children}
            </div>
            {showBottomNav && <BottomNav />}
        </div>
    );
};

export default Layout;
