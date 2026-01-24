import React from 'react';
import { useLoaderData, useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../hooks/useData';
import CdnImage from '../components/CdnImage';
import { supabase } from '../lib/supabase.client';
import { createSupabaseServerClient } from '../lib/supabase.server';
import type { LoaderFunctionArgs } from 'react-router';

export async function loader({ request }: LoaderFunctionArgs) {
    const { supabase } = createSupabaseServerClient(request);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { notifications: [] };

    const { data: rpcData, error } = await supabase.rpc('get_notifications_view_data', { 
        p_user_id: user.id 
    });

    if (error) {
        console.error("RPC Error:", error);
        return { notifications: [] };
    }

    const viewData = rpcData as unknown as import('../config/rpc').NotificationsViewData;

    const received = (viewData.incoming_requests || []).map((n: any) => ({
        ...n,
        type: 'CONNECTION_REQUEST',
        actor: n.requester,
        actor_id: n.requester_id,
        time: new Date(n.created_at).getTime()
    }));

    const accepted = (viewData.accepted_connections || []).map((n: any) => ({
        ...n,
        type: 'CONNECTION_ACCEPTED',
        actor: n.actor,
        actor_id: n.recipient_id, // For requester, recipient is the other person
        time: new Date(n.updated_at || n.created_at).getTime()
    }));

    const spied = (viewData.spied_alerts || []).map((n: any) => ({
        ...n,
        type: 'SPIED',
        actor: n.user,
        actor_id: n.user_id,
        time: new Date(n.created_at).getTime()
    }));

    const notifications = [...received, ...accepted, ...spied].sort((a, b) => b.time - a.time);
    return { notifications };
}

const Notifications: React.FC = () => {
    const { notifications: initialNotifications } = useLoaderData<typeof loader>();
    const { user: authUser } = useAuth();
    const navigate = useNavigate();
    const { data: notifications = [], isLoading: loading } = useNotifications(authUser?.id, initialNotifications);

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
                    bgColor: 'bg-primary/10',
                    link: `/profile/${notification.actor_id}`
                };
            case 'CONNECTION_ACCEPTED':
                return {
                    icon: 'handshake',
                    title: 'Request Accepted!',
                    body: `You are now connected with ${actorName}!`,
                    color: 'text-green-500',
                    bgColor: 'bg-green-500/10',
                    link: `/chat/${notification.actor_id}`
                };
            case 'SPIED':
                return {
                    icon: 'visibility',
                    title: 'Profile Spied!',
                    body: `${actorName} revealed your private photos!`,
                    color: 'text-purple-500',
                    bgColor: 'bg-purple-500/10',
                    link: `/profile/${notification.actor_id}`
                };
            case 'NEW_MESSAGE':
                return {
                    icon: 'chat',
                    title: 'New Message',
                    body: `${actorName} sent you a message.`,
                    color: 'text-blue-500',
                    bgColor: 'bg-blue-500/10',
                    link: `/chat/${notification.actor_id}`
                };
            default:
                return {
                    icon: 'notifications',
                    title: 'Update',
                    body: `New update from ${actorName}.`,
                    color: 'text-white/40',
                    bgColor: 'bg-white/5',
                    link: '#'
                };
        }
    };

    if (loading && notifications.length === 0) {
        return (
            <div className="min-h-screen w-full bg-background-dark flex items-center justify-center">
                <div className="relative">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-primary rounded-full animate-ping"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background-dark font-display antialiased relative overflow-hidden flex flex-col">
            {/* Immersive Background Elements */}
            <div className="absolute top-[10%] -right-20 w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="absolute bottom-[10%] -left-20 w-[600px] h-[600px] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none"></div>

            {/* Header */}
            <header className="sticky top-0 z-50 w-full bg-background-dark/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="size-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-all active:scale-95 group"
                        >
                            <Icon name="arrow_back" className="text-[24px] group-hover:-translate-x-0.5 transition-transform" />
                        </button>
                        <h1 className="text-2xl font-black text-white tracking-tight">Notifications</h1>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-12 relative z-10">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                        <div className="size-24 rounded-[40px] bg-white/5 border border-white/10 flex items-center justify-center mb-8 shadow-2xl relative group overflow-hidden">
                            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <Icon name="notifications_off" className="text-4xl text-white/20 group-hover:text-primary/40 transition-colors" />
                        </div>
                        <h2 className="text-xl font-black text-white mb-2 tracking-tight">Nothing to see here</h2>
                        <p className="text-sm font-medium text-white/40 max-w-[240px] leading-relaxed">
                            Stay active and connect with people to see what's happening.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {notifications.map((notification: any, index: number) => {
                            const content = getNotificationContent(notification);
                            return (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    transition={{ 
                                        delay: index * 0.04,
                                        type: "spring",
                                        stiffness: 100,
                                        damping: 15
                                    }}
                                    key={notification.id}
                                    onClick={() => navigate(content.link)}
                                    className="group relative flex items-start gap-5 p-5 rounded-[28px] bg-surface-dark/40 backdrop-blur-xl border border-white/5 hover:border-primary/20 hover:bg-surface-dark/60 transition-all duration-300 cursor-pointer shadow-xl shadow-black/5 active:scale-[0.98]"
                                >
                                    {/* Action Hover Background */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/[0.02] to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity rounded-[28px]"></div>

                                    <div className="relative shrink-0">
                                        <div className="size-16 rounded-[22px] overflow-hidden border-2 border-white/10 group-hover:border-primary/30 transition-colors shadow-2xl p-0.5">
                                            <CdnImage
                                                path={notification.actor?.profile_picture_url}
                                                gender={notification.actor?.gender}
                                                seed={notification.actor_id}
                                                className="w-full h-full object-cover rounded-2xl"
                                            />
                                        </div>
                                        <div className={`absolute -bottom-1 -right-1 size-7 rounded-2xl ${content.bgColor} backdrop-blur-md flex items-center justify-center border border-white/10 shadow-lg`}>
                                            <Icon name={content.icon} className={`text-[14px] ${content.color}`} />
                                        </div>
                                    </div>

                                    <div className="flex-1 pt-1">
                                        <div className="flex items-start justify-between gap-4 mb-1">
                                            <h3 className="text-base font-black text-white group-hover:text-primary transition-colors leading-tight">
                                                {content.title}
                                            </h3>
                                            <span className="shrink-0 text-[10px] font-black text-white/20 uppercase tracking-[0.2em] pt-0.5">
                                                {formatNotificationTime(notification.updated_at || notification.created_at)}
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium text-white/50 leading-relaxed group-hover:text-white/70 transition-colors">
                                            {content.body}
                                        </p>
                                    </div>

                                    {/* Arrow hint on hover */}
                                    <div className="shrink-0 flex items-center justify-center size-8 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                                        <Icon name="chevron_right" className="text-primary text-xl" />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Bottom Spacer for Mobile Navigation if present */}
            <div className="h-24 lg:hidden"></div>
        </div>
    );
};

export default Notifications;
