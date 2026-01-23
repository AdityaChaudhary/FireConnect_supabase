import React from 'react';
import { useLocation, useNavigation } from 'react-router';
import { useSafeNavigate } from '../hooks/useSafeNavigate';
import Icon from './Icon';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useUnreadBadge } from '../hooks/useData';

const BottomNav: React.FC = () => {
    const { safeNavigate } = useSafeNavigate();
    const location = useLocation();
    const { user: authUser } = useAuth();
    const navigation = useNavigation();

    const isActive = (path: string) => location.pathname === path;
    const isNavigatingTo = (path: string) => navigation.location?.pathname === path;
    const hasUnread = useUnreadBadge(authUser?.id);

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 glass-nav border-t border-white/5 max-w-md mx-auto">
            <div className="flex justify-around items-center h-[80px] px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
                <button
                    onClick={() => safeNavigate('/')}
                    disabled={navigation.state === 'loading'}
                    className={`flex flex-col items-center justify-center w-full gap-1 p-2 transition-colors group relative ${isActive('/') ? 'text-primary' : 'text-white/50 hover:text-white'}`}
                >
                    <div className={`p-1 rounded-2xl transition-all relative ${isActive('/') ? 'bg-primary/10' : 'group-hover:bg-white/5'} ${isNavigatingTo('/') ? 'scale-90 opacity-70' : ''}`}>
                        <Icon type="lucide" name="LayoutGrid" size={24} className={`transition-transform ${isNavigatingTo('/') ? 'animate-pulse' : 'group-hover:scale-110'}`} />
                        {isNavigatingTo('/') && (
                            <motion.div 
                                layoutId="nav-loading"
                                className="absolute inset-0 bg-primary/20 rounded-2xl animate-pulse blur-md"
                            />
                        )}
                    </div>
                    <span className="text-[10px] font-medium">Discover</span>
                </button>

                <button
                    onClick={() => safeNavigate('/matches')}
                    disabled={navigation.state === 'loading'}
                    className={`flex flex-col items-center justify-center w-full gap-1 p-2 transition-colors group relative ${isActive('/matches') ? 'text-primary' : 'text-white/50 hover:text-white'}`}
                >
                    <div className={`p-1 rounded-2xl transition-all relative ${isActive('/matches') ? 'bg-primary/10' : 'group-hover:bg-white/5'} ${isNavigatingTo('/matches') ? 'scale-90 opacity-70' : ''}`}>
                        <Icon type="lucide" name="Compass" size={24} className={`transition-transform ${isNavigatingTo('/matches') ? 'animate-pulse' : 'group-hover:scale-110'}`} />
                        {isNavigatingTo('/matches') && (
                            <motion.div 
                                layoutId="nav-loading"
                                className="absolute inset-0 bg-primary/20 rounded-2xl animate-pulse blur-md"
                            />
                        )}
                    </div>
                    <span className="text-[10px] font-medium">Explore</span>
                </button>

                <button 
                    onClick={() => safeNavigate('/random-chat')}
                    disabled={navigation.state === 'loading'}
                    className={`flex items-center justify-center -mt-8 size-14 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95 ${isActive('/random-chat') ? 'bg-white text-primary' : 'bg-primary text-white shadow-primary/40'} ${isNavigatingTo('/random-chat') ? 'animate-spin-slow' : ''}`}
                >
                    <Icon type="lucide" name={isNavigatingTo('/random-chat') ? "Loader2" : "Shuffle"} size={28} className={isNavigatingTo('/random-chat') ? "animate-spin" : ""} />
                </button>

                <button
                    onClick={() => safeNavigate('/chat')}
                    disabled={navigation.state === 'loading'}
                    className={`flex flex-col items-center justify-center w-full gap-1 p-2 transition-colors group relative ${isActive('/chat') ? 'text-primary' : 'text-white/50 hover:text-white'}`}
                >
                    <motion.div
                        animate={hasUnread ? {
                            y: [0, -8, 0, -4, 0],
                            transition: {
                                duration: 0.6,
                                ease: "easeInOut",
                                times: [0, 0.2, 0.5, 0.8, 1]
                            }
                        } : { y: 0 }}
                        className={`p-1 rounded-2xl transition-all relative ${isActive('/chat') ? 'bg-primary/10' : 'group-hover:bg-white/5'} ${isNavigatingTo('/chat') ? 'scale-90 opacity-70' : ''}`}
                    >
                        <Icon type="lucide" name="MessageCircle" size={24} className={`transition-transform ${isNavigatingTo('/chat') ? 'animate-pulse' : 'group-hover:scale-110'}`} />
                        <AnimatePresence>
                            {hasUnread && (
                                <motion.span
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0, opacity: 0 }}
                                    className="absolute top-1 right-1 size-2.5 bg-primary border-2 border-[#160a11] rounded-full"
                                />
                            )}
                        </AnimatePresence>
                        {isNavigatingTo('/chat') && (
                            <motion.div 
                                layoutId="nav-loading"
                                className="absolute inset-0 bg-primary/20 rounded-2xl animate-pulse blur-md"
                            />
                        )}
                    </motion.div>
                    <span className="text-[10px] font-medium">Chat</span>
                </button>

                <button
                    onClick={() => safeNavigate('/profile')}
                    disabled={navigation.state === 'loading'}
                    className={`flex flex-col items-center justify-center w-full gap-1 p-2 transition-colors group relative ${isActive('/profile') ? 'text-primary' : 'text-white/50 hover:text-white'}`}
                >
                    <div className={`p-1 rounded-2xl transition-all relative ${isActive('/profile') ? 'bg-primary/10' : 'group-hover:bg-white/5'} ${isNavigatingTo('/profile') ? 'scale-90 opacity-70' : ''}`}>
                        <Icon type="lucide" name="User" size={24} className={`transition-transform ${isNavigatingTo('/profile') ? 'animate-pulse' : 'group-hover:scale-110'}`} />
                        {isNavigatingTo('/profile') && (
                            <motion.div 
                                layoutId="nav-loading"
                                className="absolute inset-0 bg-primary/20 rounded-2xl animate-pulse blur-md"
                            />
                        )}
                    </div>
                    <span className="text-[10px] font-medium">Profile</span>
                </button>
            </div>
        </nav>
    );
};

export default BottomNav;
