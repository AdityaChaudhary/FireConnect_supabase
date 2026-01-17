import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from './Icon';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const NotificationIcon: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [hasNew, setHasNew] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const checkNotifications = async () => {
            try {
                const [notifRes, checkRes] = await Promise.all([
                    supabase
                        .from('connections')
                        .select('created_at, updated_at')
                        .eq('recipient_id', user.id)
                        .order('updated_at', { ascending: false })
                        .limit(50),
                    supabase
                        .from('users')
                        .select('last_notification_check')
                        .eq('id', user.id)
                        .single()
                ]);

                const lastCheckedAt = checkRes.data?.last_notification_check
                    ? new Date(checkRes.data.last_notification_check).getTime()
                    : 0;

                const latestNotificationTime = (notifRes.data || []).reduce((max, n) => {
                    const time = new Date(n.updated_at || n.created_at).getTime();
                    return Math.max(max, time);
                }, 0);

                setHasNew(latestNotificationTime > lastCheckedAt);
            } catch (error) {
                console.error("Error checking notifications:", error);
            } finally {
                setLoading(false);
            }
        };

        let currentInterval = 15000;
        let timeoutId: NodeJS.Timeout;

        const poll = async () => {
            await checkNotifications();
            currentInterval = Math.min(currentInterval + 5000, 120000);
            timeoutId = setTimeout(poll, currentInterval);
        };

        poll();
        return () => clearTimeout(timeoutId);
    }, [user]);

    const handleClick = () => {
        navigate('/notifications');
    };

    return (
        <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleClick}
            className="relative p-2 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/20 transition-colors flex items-center justify-center group"
        >
            <Icon
                name="notifications"
                className={`text-2xl transition-colors ${hasNew ? 'text-primary' : 'text-white'}`}
            />

            <AnimatePresence>
                {hasNew && (
                    <motion.span
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="absolute top-2 right-2 w-2.5 h-2.5 bg-primary rounded-full border-2 border-background-dark shadow-[0_0_8px_rgba(236,19,146,0.5)]"
                    >
                        <motion.span
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="absolute inset-0 bg-primary rounded-full"
                        />
                    </motion.span>
                )}
            </AnimatePresence>
        </motion.button>
    );
};

export default NotificationIcon;
