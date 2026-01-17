import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, MessageSquare, Heart, User } from 'lucide-react';

const BottomNav: React.FC = () => {
    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-background-dark/80 backdrop-blur-lg border-t border-white/10 px-6 py-3 flex justify-between items-center max-w-md mx-auto z-50">
            <NavLink to="/" className={({ isActive }) => isActive ? "text-primary transition-colors" : "text-white/40 hover:text-white/60 transition-colors"}>
                <Home size={24} />
            </NavLink>
            <NavLink to="/matches" className={({ isActive }) => isActive ? "text-primary transition-colors" : "text-white/40 hover:text-white/60 transition-colors"}>
                <Heart size={24} />
            </NavLink>
            <NavLink to="/chat" className={({ isActive }) => isActive ? "text-primary transition-colors" : "text-white/40 hover:text-white/60 transition-colors"}>
                <MessageSquare size={24} />
            </NavLink>
            <NavLink to="/profile" className={({ isActive }) => isActive ? "text-primary transition-colors" : "text-white/40 hover:text-white/60 transition-colors"}>
                <User size={24} />
            </NavLink>
        </nav>
    );
};

export default BottomNav;
