import React from 'react';
import { useLocation } from 'react-router';
import { useSafeNavigate } from '../hooks/useSafeNavigate';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';
import CdnImage from './CdnImage';

const Sidebar: React.FC = () => {
    const { safeNavigate } = useSafeNavigate();
    const location = useLocation();
    const { user: authUser, profile, stripeRole } = useAuth();

    const isActive = (path: string) => location.pathname === path;

    const navItems = [
        { name: 'Discovery', path: '/', icon: 'LayoutGrid', lucide: true },
        { name: 'Explore', path: '/matches', icon: 'Compass', lucide: true },
        { name: 'Messages', path: '/chat', icon: 'MessageCircle', lucide: true },
        { name: 'Profile', path: '/profile', icon: 'User', lucide: true },
        { name: 'Settings', path: '/settings', icon: 'settings', lucide: false },
    ];

    return (
        <aside className="hidden lg:flex flex-col w-[280px] h-screen sticky top-0 bg-background-dark border-r border-white/5 p-6 z-50">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer" onClick={() => safeNavigate('/')}>
                <div className="size-10 bg-gradient-to-tr from-fire-pink to-neon-purple rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                    <Icon name="local_fire_department" className="text-white text-2xl" />
                </div>
                <h1 className="text-xl font-black tracking-tighter text-white uppercase">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-fire-pink to-neon-purple">Fire</span>Connect
                </h1>
            </div>

            {/* Navigation */}
            <nav className="flex-1 flex flex-col gap-2">
                {navItems.map((item) => (
                    <button
                        key={item.path}
                        onClick={() => safeNavigate(item.path)}
                        className={`flex items-center gap-4 px-4 py-3 rounded-2xl transition-all group ${
                            isActive(item.path)
                                ? 'bg-primary/10 text-primary'
                                : 'text-white/50 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <Icon
                            name={item.icon}
                            type={item.lucide ? 'lucide' : 'material'}
                            size={22}
                            className={`transition-transform group-hover:scale-110 ${isActive(item.path) ? 'text-primary' : ''}`}
                        />
                        <span className="font-semibold text-sm tracking-wide">{item.name}</span>
                        {isActive(item.path) && (
                            <div className="ml-auto size-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(236,19,146,0.5)]" />
                        )}
                    </button>
                ))}
            </nav>

            {/* Bottom User Profile */}
            <div className="pt-6 border-t border-white/5">
                <button 
                    onClick={() => safeNavigate('/profile')}
                    className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-all group w-full text-left"
                >
                    <div className="relative">
                        <CdnImage
                            path={profile?.profile_picture_url}
                            gender={profile?.gender}
                            seed={authUser?.id}
                            className="size-10 rounded-full ring-2 ring-white/10 group-hover:ring-primary/30 transition-all bg-cover bg-center"
                            useAsBackground
                        />
                        <div className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full border-2 border-background-dark"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{profile?.display_name || profile?.username || 'User'}</p>
                        <p className="text-[10px] font-black tracking-widest text-primary uppercase">{stripeRole || 'LITE'}</p>
                    </div>
                    <Icon name="more_vert" className="text-white/20 group-hover:text-white/50" />
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
