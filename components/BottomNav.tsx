import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useUnreadBadge } from '../hooks/useData';

const BottomNav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user: authUser } = useAuth();

    const isActive = (path: string) => location.pathname === path;
    const hasUnread = useUnreadBadge(authUser?.id);

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 glass-nav border-t border-white/5 max-w-md mx-auto">
            <div className="flex justify-around items-center h-[80px] px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
                <button
                    onClick={() => navigate('/')}
                    className={`flex flex-col items-center justify-center w-full gap-1 p-2 transition-colors group ${isActive('/') ? 'text-primary' : 'text-white/50 hover:text-white'}`}
                >
                    <div className={`p-1 rounded-2xl transition-colors ${isActive('/') ? 'bg-primary/10' : 'group-hover:bg-white/5'}`}>
                        <Icon name="grid_view" className="text-[28px]" filled={isActive('/')} />
                    </div>
                    <span className="text-[10px] font-medium">Discover</span>
                </button>

                <button
                    onClick={() => navigate('/matches')}
                    className={`flex flex-col items-center justify-center w-full gap-1 p-2 transition-colors group ${isActive('/matches') ? 'text-primary' : 'text-white/50 hover:text-white'}`}
                >
                    <div className={`p-1 rounded-2xl transition-colors ${isActive('/matches') ? 'bg-primary/10' : 'group-hover:bg-white/5'}`}>
                        <Icon name="explore" className="text-[28px]" filled={isActive('/matches')} />
                    </div>
                    <span className="text-[10px] font-medium">Explore</span>
                </button>

                <button className="flex items-center justify-center -mt-8 size-14 rounded-full bg-primary text-white shadow-lg shadow-primary/40 hover:scale-105 active:scale-95 transition-all">
                    <Icon name="add" className="text-[32px]" />
                </button>

                <button
                    onClick={() => navigate('/chat')}
                    className={`flex flex-col items-center justify-center w-full gap-1 p-2 transition-colors group ${isActive('/chat') ? 'text-primary' : 'text-white/50 hover:text-white'}`}
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
                        className={`p-1 rounded-2xl transition-colors relative ${isActive('/chat') ? 'bg-primary/10' : 'group-hover:bg-white/5'}`}
                    >
                        <Icon name="chat" className="text-[28px]" filled={isActive('/chat')} />
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
                    </motion.div>
                    <span className="text-[10px] font-medium">Chat</span>
                </button>

                <button
                    onClick={() => navigate('/profile')}
                    className={`flex flex-col items-center justify-center w-full gap-1 p-2 transition-colors group ${isActive('/profile') ? 'text-primary' : 'text-white/50 hover:text-white'}`}
                >
                    <div className={`p-1 rounded-2xl transition-colors ${isActive('/profile') ? 'bg-primary/10' : 'group-hover:bg-white/5'}`}>
                        <Icon name="person" className="text-[28px]" filled={isActive('/profile')} />
                    </div>
                    <span className="text-[10px] font-medium">Profile</span>
                </button>
            </div>
        </nav>
    );
};

export default BottomNav;
