import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../hooks/useData';
import CdnImage from '../components/CdnImage';
import { getDefaultAvatar } from '../lib/image-utils';
import { supabase } from '../lib/supabase';

const Notifications: React.FC = () => {
    const { user: authUser } = useAuth();
    const navigate = useNavigate();
    const { data: notifications = [], isLoading: loading } = useNotifications(authUser?.id);

    React.useEffect(() => {
        if (!authUser) return;

        const markAsRead = async () => {
            const { error } = await supabase
                .from('notification_check')
                .update({ last_checked_at: new Date().toISOString() })
                .eq('user_id', authUser.id);
            
            if (error) {
                console.error("Error updating notification check time:", error);
            }
        };

        markAsRead();
    }, [authUser]);

    const formatNotificationTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    };

    const getNotificationContent = (notification: any) => {
        const actorName = notification.actor?.display_name || notification.actor?.username || 'Someone';

        switch (notification.type) {
            case 'CONNECTION_REQUEST':
                return {
                    icon: 'person_add',
                    title: 'New Connection Request',
                    body: `${actorName} sent you a connection request.`,
                    color: 'text-primary',
                    link: `/profile/${notification.actor_id}`
                };
            case 'CONNECTION_ACCEPTED':
                return {
                    icon: 'handshake',
                    title: 'Request Accepted!',
                    body: `You are now connected with ${actorName}!`,
                    color: 'text-green-400',
                    link: `/chat/${notification.actor_id}`
                };
            case 'SPIED':
                return {
                    icon: 'visibility',
                    title: 'Profile Spied!',
                    body: `${actorName} revealed your private photos!`,
                    color: 'text-purple-400',
                    link: `/profile/${notification.actor_id}`
                };
            case 'NEW_MESSAGE':
                return {
                    icon: 'chat',
                    title: 'New Message',
                    body: `${actorName} sent you a message.`,
                    color: 'text-blue-400',
                    link: `/chat/${notification.actor_id}`
                };
            default:
                return {
                    icon: 'notifications',
                    title: 'Update',
                    body: `New update from ${actorName}.`,
                    color: 'text-white/40',
                    link: '#'
                };
        }
    };

    if (loading && notifications.length === 0) {
        return (
            <div className="min-h-screen w-full bg-background-dark flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background-dark flex flex-col pb-24">
            {/* Header */}
            <header className="sticky top-0 z-40 flex items-center p-4 bg-background-dark/95 backdrop-blur-md border-b border-white/5">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 rounded-full hover:bg-white/5 active:scale-95 transition-all text-white"
                >
                    <Icon name="arrow_back" />
                </button>
                <h1 className="ml-2 text-xl font-bold text-white">Notifications</h1>
            </header>

            <main className="flex-1 overflow-y-auto px-4 py-6">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-white/20">
                        <Icon name="notifications_off" className="text-6xl mb-4" />
                        <p className="text-sm font-medium">No notifications yet.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {notifications.map((notification: any, index: number) => {
                            const content = getNotificationContent(notification);
                            return (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    key={notification.id}
                                    onClick={() => navigate(content.link)}
                                    className="flex items-start gap-4 p-4 rounded-2xl bg-surface-dark border border-white/5 hover:border-white/10 active:scale-[0.98] transition-all cursor-pointer group"
                                >
                                    <div className="relative">
                                        <div className="size-12 rounded-full overflow-hidden border-2 border-white/10">
                                            <CdnImage
                                                path={notification.actor?.profile_picture_url}
                                                placeholder={getDefaultAvatar(notification.actor?.gender)}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-background-dark flex items-center justify-center border border-white/5 shadow-lg">
                                            <Icon name={content.icon} className={`text-[12px] ${content.color}`} />
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <h3 className="text-[15px] font-bold text-white group-hover:text-primary transition-colors">
                                                {content.title}
                                            </h3>
                                            <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider">
                                                {formatNotificationTime(notification.created_at)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-white/50 leading-relaxed font-medium">
                                            {content.body}
                                        </p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
};

export default Notifications;
