import React from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../hooks/useData';

const NotificationIcon: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { data } = useNotifications(user?.id);
    const { notifications = [], lastCheckedAt } = data || {};

    const hasNew = React.useMemo(() => {
        if (!lastCheckedAt) return notifications.length > 0;
        const lastCheckedTime = new Date(lastCheckedAt).getTime();
        return notifications.some((n: any) => {
            const time = new Date(n.updated_at || n.created_at).getTime();
            return time > lastCheckedTime;
        });
    }, [notifications, lastCheckedAt]);

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
