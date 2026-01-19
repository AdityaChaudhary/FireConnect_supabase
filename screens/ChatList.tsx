import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import NotificationIcon from '../components/NotificationIcon';
import { useAuth } from '../context/AuthContext';
import { useConnections, useThreads } from '../hooks/useData';
import CdnImage from '../components/CdnImage';
import { getDefaultAvatar } from '../lib/image-utils';

const ChatList: React.FC = () => {
    const { user: authUser } = useAuth();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');

    const { data: connectionsData, isLoading: connectionsLoading } = useConnections(authUser?.id);
    const { data: threads = [], isLoading: threadsLoading } = useThreads(authUser?.id);

    const connections = connectionsData?.connections || [];
    const onlineConnections = connections.filter((c: any) => {
        const lastSeen = c.user_online_status?.[0]?.last_seen_at;
        if (!lastSeen) return false;
        const diff = Date.now() - new Date(lastSeen).getTime();
        return diff < 5 * 60 * 1000; // Online if seen in last 5 minutes
    });

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
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-background-dark h-full pb-20 overflow-hidden">
            {/* Header */}
            <header className="px-6 pt-6 pb-4 bg-background-dark">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-black text-white tracking-tight">Messages</h1>
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
                        className="w-full h-12 bg-surface-dark border border-white/5 rounded-2xl pl-12 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                    />
                </div>
            </header>

            <main className="flex-1 overflow-y-auto scrollbar-hide">
                {/* Stories / Online Connections Section */}
                {onlineConnections.length > 0 && (
                    <section className="py-4">
                        <div className="flex items-center gap-2 px-6 mb-4">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Online Now</h3>
                            <div className="h-px flex-1 bg-white/5"></div>
                        </div>
                        <div className="flex gap-4 overflow-x-auto px-6 scrollbar-hide">
                            {onlineConnections.map((user: any) => (
                                <button
                                    key={user.id}
                                    onClick={() => navigate(`/chat/${user.id}`, {
                                        state: {
                                            user: {
                                                name: user.display_name,
                                                avatar: user.profile_picture_url || getDefaultAvatar(user.gender, user.id),
                                                userType: user.user_type,
                                                isTheyMax: user.stripe_role === 'MAX' || user.user_type === 'AI'
                                            }
                                        }
                                    })}
                                    className="flex flex-col items-center gap-2 flex-shrink-0 group"
                                >
                                    <div className="relative">
                                        <div className="size-16 rounded-[22px] p-0.5 bg-gradient-to-tr from-primary to-purple-500 shadow-lg shadow-primary/20 group-active:scale-90 transition-all">
                                            <div className="w-full h-full rounded-[20px] overflow-hidden border-2 border-background-dark bg-surface-dark">
                                                <CdnImage
                                                    path={user.profile_picture_url}
                                                    gender={user.gender}
                                                    seed={user.id}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        </div>
                                        <div className="absolute bottom-0 right-0 size-4 bg-green-500 border-2 border-background-dark rounded-full"></div>
                                    </div>
                                    <span className="text-[10px] font-bold text-white/60 truncate w-16 text-center">{user.display_name || user.username}</span>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {/* Chat List Section */}
                <section className="px-4 py-2 space-y-1">
                    <div className="flex items-center gap-2 px-2 mb-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Recent Chats</h3>
                        <div className="h-px flex-1 bg-white/5"></div>
                    </div>

                    {filteredThreads.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center text-center px-10">
                            <div className="size-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                <Icon name="chat_bubble_outline" className="text-4xl text-white/10" />
                            </div>
                            <h4 className="text-lg font-bold text-white mb-2">No messages yet</h4>
                            <p className="text-sm text-white/40">Start a conversation with your connections!</p>
                        </div>
                    ) : (
                        filteredThreads.map((thread: any) => {
                            const otherUser = thread.otherUser;
                            if (!otherUser) return null;

                            return (
                                <div
                                    key={thread.id}
                                    onClick={() => navigate(`/chat/${otherUser.id}`, {
                                        state: {
                                            user: {
                                                name: otherUser.display_name,
                                                avatar: otherUser.profile_picture_url || getDefaultAvatar(otherUser.gender),
                                                userType: otherUser.user_type,
                                                isTheyMax: otherUser.stripe_role === 'MAX' || otherUser.user_type === 'AI'
                                            }
                                        }
                                    })}
                                    className="flex items-center gap-4 p-4 rounded-3xl hover:bg-white/5 transition-all cursor-pointer group active:scale-[0.98]"
                                >
                                    <div className="relative">
                                        <div className="size-14 rounded-2xl overflow-hidden bg-white/5 border border-white/5">
                                            <CdnImage
                                                path={otherUser.profile_picture_url}
                                                gender={otherUser.gender}
                                                seed={otherUser.id}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            />
                                        </div>
                                        {/* Optional status dot */}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <h4 className={`text-sm tracking-tight truncate ${isUnread(thread) ? 'font-black text-white' : 'font-bold text-white/80'}`}>
                                                {otherUser.display_name || otherUser.username}
                                            </h4>
                                            <span className={`text-[10px] font-bold ${isUnread(thread) ? 'text-primary' : 'text-white/20'}`}>
                                                {formatMessageTime(thread.last_message_time)}
                                            </span>
                                        </div>
                                        <p className={`text-xs truncate leading-relaxed ${isUnread(thread) ? 'text-white/80 font-bold' : 'text-white/40'}`}>
                                            {thread.last_message_sender_id === authUser?.id ? 'You: ' : ''}{thread.last_message || 'Start a conversation...'}
                                        </p>
                                    </div>

                                    {isUnread(thread) && (
                                        <div className="size-2.5 rounded-full bg-primary shadow-lg shadow-primary/40 flex-shrink-0 animate-pulse"></div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </section>
            </main>
        </div>
    );
};

export default ChatList;
