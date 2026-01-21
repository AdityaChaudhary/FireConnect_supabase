import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase.client';

const OnlineStatusTracker: React.FC = () => {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) {
            console.log("OnlineStatusTracker: No user, stopping tracker.");
            return;
        }

        const updateStatus = async () => {
            if (!user) return; // Guard for async execution after logout
            try {
                await supabase
                    .from('user_online_status')
                    .upsert({ user_id: user.id, last_seen_at: new Date().toISOString() });
            } catch (e) {
                // Silently fail background status updates to avoid console noise
                console.warn("OnlineStatusTracker: Failed to update status", e);
            }
        };

        updateStatus();
        const interval = setInterval(updateStatus, 60 * 1000); // Update every minute

        return () => clearInterval(interval);
    }, [user]);

    return null;
};

export default OnlineStatusTracker;
