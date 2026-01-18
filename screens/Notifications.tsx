import React from 'react';
import { useNavigate } from 'react-router-dom';
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
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
        return date.toLocaleDateString();
    };

    const getNotificationContent = (notification: any) => {
        const actorName = notification.actor?.display_name || notification.actor?.username || 'Someone';

        switch (notification.type) {
            case 'CONNECTION_REQUEST':
                return {
                    icon: 'person_add',
                    text: `${actorName} sent you a connection request.`,
                    color: 'text-primary',
                    link: `/profile/${notification.actor_id}`
                };
            case 'CONNECTION_ACCEPTED':
                return {
                    icon: 'link',
                    text: `You are now connected with ${actorName}!`,
                    color: 'text-green-400',
                    link: `/chat/${notification.actor_id}`
                };
            case 'SPIED':
                return {
                    icon: 'visibility',
                    text: `${actorName} revealed your private photos!`,
                    color: 'text-amber-400',
                    link: `/profile/${notification.actor_id}`
                };
            case 'NEW_MESSAGE':
                return {
                    icon: 'chat',
                    text: `${actorName} sent you a message.`,
                    color: 'text-blue-400',
                    link: `/chat/${notification.actor_id}`
                };
            default:
                return {
                    icon: 'notifications',
                    text: `New update from ${actorName}.`,
                    color: 'text-white/40',
                    link: '#'
                };
        }
    };

    if (loading && notifications.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center bg-background-dark">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-background-dark min-h-screen pb-24">
            <header className="flex items-center justify-between px-6 pt-6 pb-4 sticky top-0 bg-background-dark/80 backdrop-blur-md z-20">
                <h1 className="text-3xl font-black text-white tracking-tight">Activity</h1>
                <div className="size-10 rounded-full bg-white/5 flex items-center justify-center text-white/40">
                    <Icon name="history" />
                </div>
            </header>

            <main className="flex-1 px-4 space-y-2 mt-2">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-10">
                        <div className="size-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                            <Icon name="notifications_none" className="text-4xl text-white/10" />
                        </div>
                        <h4 className="text-lg font-bold text-white mb-2">No notifications yet</h4>
                        <p className="text-sm text-white/40">When people connect with you or send messages, you'll see them here.</p>
                    </div>
                ) : (
                    notifications.map((notification: any) => {
                        const content = getNotificationContent(notification);
                        return (
                            <div
                                key={notification.id}
                                onClick={() => navigate(content.link)}
                                className="group flex items-center gap-4 p-4 rounded-3xl bg-surface-dark/50 hover:bg-surface-dark border border-white/5 transition-all cursor-pointer active:scale-[0.98]"
                            >
                                <div className="relative">
                                    <div className="size-14 rounded-2xl overflow-hidden bg-white/5 border border-white/5">
                                        <CdnImage
                                            path={notification.actor?.profile_picture_url}
                                            placeholder={getDefaultAvatar(notification.actor?.gender)}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className={`absolute -bottom-1 -right-1 size-6 rounded-full bg-surface-dark border-2 border-background-dark flex items-center justify-center shadow-lg ${content.color}`}>
                                        <Icon name={content.icon} className="text-[10px]" />
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white/80 leading-snug">
                                        {content.text}
                                    </p>
                                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mt-1">
                                        {formatNotificationTime(notification.created_at)}
                                    </p>
                                </div>

                                <div className="size-8 rounded-full bg-white/5 flex items-center justify-center text-white/20 group-hover:text-primary transition-colors">
                                    <Icon name="chevron_right" />
                                </div>
                            </div>
                        );
                    })
                )}
            </main>
        </div>
    );
};

export default Notifications;
