import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const OnlineStatusTracker: React.FC = () => {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        const updateStatus = async () => {
            await supabase
                .from('user_online_status')
                .upsert({ user_id: user.id, last_seen_at: new Error().stack ? new Date().toISOString() : new Date().toISOString() });
        };

        updateStatus();
        const interval = setInterval(updateStatus, 60 * 1000); // Update every minute

        return () => clearInterval(interval);
    }, [user]);

    return null;
};

export default OnlineStatusTracker;
