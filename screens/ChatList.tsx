import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../components/Icon';
import NotificationIcon from '../components/NotificationIcon';
import { useAuth } from '../context/AuthContext';
import { useConnections, useThreads } from '../hooks/useData';
import CdnImage from '../components/CdnImage';
import { getDefaultAvatar } from '../lib/image-utils';
import MatchAvatar from '../components/MatchAvatar';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.client';

const ChatList: React.FC = () => {
    const { user: authUser } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [currentTime, setCurrentTime] = useState(Date.now());

    const { data: connectionsData, isLoading: connectionsLoading } = useConnections(authUser?.id);
    const { data: threads = [], isLoading: threadsLoading } = useThreads(authUser?.id);

    const connections = connectionsData?.connections || [];

    // Periodic time update to re-evaluate "Online" status
    useEffect(() => {
        const intervalId = setInterval(() => {
            setCurrentTime(Date.now());
        }, 10000); // 10s
        return () => clearInterval(intervalId);
    }, []);

    // Real-time subscription to online status changes
    useEffect(() => {
        if (!authUser?.id) return;

        const channel = supabase
            .channel('chatlist-online-status')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_online_status'
                },
                () => {
                    // Invalidate connections query to refresh the online_status join
                    queryClient.invalidateQueries({ queryKey: ['connections', authUser.id] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [authUser?.id, queryClient]);
    
    const onlineConnections = useMemo(() => {
        return connections
            .filter((c: any) => {
                const status = c.user_online_status;
                const lastSeen = Array.isArray(status) ? status[0]?.last_seen_at : status?.last_seen_at;
                
                if (!lastSeen) return false;
                const diff = currentTime - new Date(lastSeen).getTime();
                return diff < 5 * 60 * 1000; // Online if seen in last 5 minutes
            })
            .sort((a: any, b: any) => {
                const statusA = a.user_online_status;
                const statusB = b.user_online_status;
                const lastSeenA = new Date(Array.isArray(statusA) ? statusA[0]?.last_seen_at : statusA?.last_seen_at || 0).getTime();
                const lastSeenB = new Date(Array.isArray(statusB) ? statusB[0]?.last_seen_at : statusB?.last_seen_at || 0).getTime();
                return lastSeenB - lastSeenA;
            });
    }, [connections]);


    const filteredOnlineConnections = useMemo(() => {
        if (!searchQuery) return onlineConnections;
        
        return onlineConnections.filter((c: any) => 
            (c.display_name || c.username || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [onlineConnections, searchQuery]);

    const filteredThreads = threads.filter((thread: any) => {
        const otherUser = thread.otherUser;
        if (!otherUser) return false;
        const name = (otherUser.display_name || otherUser.username || '').toLowerCase();
        return name.includes(searchQuery.toLowerCase());
    });

    const formatMessageTime = (timestamp: string) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const isUnread = (thread: any) => {
        if (!authUser || !thread.last_message_time || !thread.last_message) return false;
        
        // If we are the sender of the last message, it's not unread for us
        if (thread.last_message_sender_id === authUser.id) return false;
        
        const lastRead = thread.last_read?.[authUser.id];
        if (!lastRead) return true; // Never read
        return new Date(thread.last_message_time) > new Date(lastRead);
    };

    if ((threadsLoading || connectionsLoading) && threads.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center bg-background-dark">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col bg-background-dark h-full pb-20 overflow-hidden"
        >
            {/* Header */}
            <header className="px-6 pt-6 pb-4 bg-background-dark/80 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-black text-white tracking-tight">Connections</h1>
                    <div className="flex items-center gap-3">
                        <NotificationIcon />
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors">
                        <Icon name="search" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search conversations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-12 bg-surface-dark border border-white/5 rounded-2xl pl-12 pr-12 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all font-medium"
                    />
                    <AnimatePresence>
                        {searchQuery && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                onClick={() => setSearchQuery('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                            >
                                <Icon name="close" className="text-lg" />
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto px-2">
                {/* Stories / Online Connections Section */}
                <motion.section 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="py-4"
                >
                    <div className="flex items-center justify-between px-4 mb-4">
                        <h3 className="text-white text-lg font-extrabold tracking-tight">Online matches</h3>
                        {filteredOnlineConnections.length > 0 && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                                <div className="size-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-green-500 text-[10px] font-black uppercase tracking-wider">
                                    {filteredOnlineConnections.length} Online
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-4 overflow-x-auto px-4 py-2 scrollbar-hide mask-fade-right">
                        {filteredOnlineConnections.length > 0 ? (
                            filteredOnlineConnections.map((user: any) => {
                                const thread = threads.find((t: any) => t.participants.includes(user.id));
                                return (
                                    <MatchAvatar 
                                        key={user.id} 
                                        user={user} 
                                        thread={thread}
                                        isUnread={thread ? isUnread(thread) : false}
                                    />
                                );
                            })
                        ) : (
                            <div className="flex items-center justify-center w-full py-6 rounded-3xl bg-surface-dark/30 border border-dashed border-white/5">
                                <p className="text-white/20 text-xs font-medium italic">No online matches found</p>
                            </div>
                        )}
                    </div>
                </motion.section>

                <div className="h-6"></div>

                {/* Chat List Section */}
                <motion.section 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="px-2 py-2 space-y-1"
                >
                    <div className="flex items-center gap-2 px-4 mb-4">
                        <h3 className="text-white text-lg font-extrabold tracking-tight">Messages</h3>
                    </div>

                    {filteredThreads.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center text-center px-10">
                            <div className="size-24 rounded-[40px] bg-surface-dark border border-white/5 flex items-center justify-center mb-6 shadow-xl relative overflow-hidden group">
                                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                                <Icon name="chat_bubble_outline" className="text-5xl text-white/10 group-hover:scale-110 transition-transform duration-500" />
                            </div>
                            <h4 className="text-xl font-black text-white mb-2">No messages yet</h4>
                            <p className="text-sm text-white/40 leading-relaxed max-w-[200px]">Start a conversation with your connections!</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredThreads.map((thread: any, index: number) => {
                                const otherUser = thread.otherUser;
                                if (!otherUser) return null;

                                return (
                                    <motion.div
                                        key={thread.id}
                                        initial={{ x: -10, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: 0.3 + (index * 0.05) }}
                                        onClick={() => navigate(`/chat/${otherUser.id}`, {
                                            state: {
                                                user: {
                                                    name: otherUser.display_name,
                                                    avatar: otherUser.profile_picture_url || getDefaultAvatar(otherUser.gender, otherUser.id),
                                                    userType: otherUser.user_type,
                                                    isTheyMax: otherUser.stripe_role === 'MAX' || otherUser.user_type === 'AI'
                                                }
                                            }
                                        })}
                                        className="flex items-center gap-4 p-4 rounded-[28px] hover:bg-surface-dark transition-all duration-300 cursor-pointer group active:scale-[0.98] border border-transparent hover:border-white/5 relative overflow-hidden"
                                    >
                                        <div className="relative flex-shrink-0">
                                            <div className="size-16 rounded-[22px] overflow-hidden bg-surface-dark border border-white/10 shadow-lg relative z-10">
                                                <CdnImage
                                                    path={otherUser.profile_picture_url}
                                                    gender={otherUser.gender}
                                                    seed={otherUser.id}
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                                                />
                                            </div>
                                            {/* Decorative glow behind avatar for unread */}
                                            {isUnread(thread) && (
                                                <div className="absolute -inset-2 bg-primary/20 blur-xl rounded-full -z-0 animate-pulse"></div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0 py-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className={`text-[15px] tracking-tight truncate ${isUnread(thread) ? 'font-black text-white' : 'font-bold text-white/80'}`}>
                                                    {otherUser.display_name || otherUser.username}
                                                </h4>
                                                <span className={`text-[11px] font-bold tracking-tight ${isUnread(thread) ? 'text-primary' : 'text-white/20'}`}>
                                                    {formatMessageTime(thread.last_message_time)}
                                                </span>
                                            </div>
                                            <p className={`text-[13px] truncate leading-relaxed ${isUnread(thread) ? 'text-white/90 font-bold' : 'text-white/40'}`}>
                                                {thread.last_message_sender_id === authUser?.id ? (
                                                    <span className="text-primary/50 font-bold mr-1">You:</span>
                                                ) : ''}
                                                {thread.last_message || 'Start a conversation...'}
                                            </p>
                                        </div>

                                        {isUnread(thread) && (
                                            <div className="size-3 rounded-full bg-primary shadow-[0_0_12px_rgba(var(--primary-rgb),0.6)] flex-shrink-0 animate-pulse relative">
                                                <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-25"></div>
                                            </div>
                                        )}
                                        
                                        <div className="absolute bottom-4 right-4 text-white/0 group-hover:text-white/10 transition-colors">
                                            <Icon name="chevron_right" className="text-xl" />
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </motion.section>
            </main>
        </motion.div>
    );
};

export default ChatList;
