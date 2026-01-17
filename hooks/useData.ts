import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * Hook to fetch users for the discovery feed.
 * Shuffles them on the client side for variety.
 */
export const useDiscoveryUsers = (userId?: string) => {
    return useQuery({
        queryKey: ['discovery-users'],
        queryFn: async () => {
            const { data: users, error } = await supabase
                .from('users')
                .select(`
                    *,
                    user_online_status (last_seen_at)
                `)
                .neq('id', userId);

            if (error) throw error;
            const fetchedUsers = users || [];

            // Shuffle logic (Fisher-Yates)
            const shuffled = [...fetchedUsers];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }

            return shuffled;
        },
        staleTime: 5 * 60 * 1000,
        enabled: !!userId,
    });
};

/**
 * Hook to fetch all user connections (Connected, Pending Sent, Pending Received).
 */
export const useConnections = (userId?: string) => {
    return useQuery({
        queryKey: ['connections', userId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('connections')
                .select(`
                    *,
                    requester:users!connections_requester_id_fkey(*),
                    recipient:users!connections_recipient_id_fkey(*)
                `)
                .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`);

            if (error) throw error;

            const connections = (data || []).filter(r => r.status === 'CONNECTED').map(r =>
                r.requester_id === userId ? r.recipient : r.requester
            );

            const sentRequests = (data || []).filter(r => r.requester_id === userId && r.status === 'PENDING').map(r => r.recipient);
            const receivedRequests = (data || []).filter(r => r.recipient_id === userId && r.status === 'PENDING').map(r => r.requester);

            return {
                connections,
                sentRequests,
                receivedRequests,
                all: [...connections, ...sentRequests, ...receivedRequests]
            };
        },
        staleTime: 30 * 1000,
        enabled: !!userId,
    });
};

/**
 * Hook to fetch combined notifications.
 */
export const useNotifications = (userId?: string) => {
    return useQuery({
        queryKey: ['notifications', userId],
        queryFn: async () => {
            // Notifications logic usually involves requests where user is recipient
            // or spiedBy records, etc.
            const [requestsRes, spiedRes] = await Promise.all([
                supabase
                    .from('connections')
                    .select('*, requester:users!connections_requester_id_fkey(*)')
                    .eq('recipient_id', userId)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('spied_profiles')
                    .select('*, user:users!spied_profiles_user_id_fkey(*)')
                    .eq('target_user_id', userId)
                    .order('created_at', { ascending: false })
            ]);

            const received = (requestsRes.data || []).map((n: any) => ({
                ...n,
                type: 'CONNECTION_REQUEST',
                user: n.requester,
                time: new Date(n.created_at).getTime()
            }));

            const spied = (spiedRes.data || []).map((n: any) => ({
                ...n,
                type: 'SPIED',
                user: n.user,
                time: new Date(n.created_at).getTime()
            }));

            return [...received, ...spied].sort((a, b) => b.time - a.time);
        },
        staleTime: 10 * 1000,
        enabled: !!userId,
    });
};

/**
 * Hook to fetch a user's profile images.
 */
export const useProfileImages = (userId: string) => {
    return useQuery({
        queryKey: ['profile-images', userId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profile_images')
                .select('*')
                .eq('user_id', userId);

            if (error) throw error;

            return (data || []).sort((a, b) => {
                if (a.is_profile) return -1;
                if (b.is_profile) return 1;
                return (a.order || 0) - (b.order || 0);
            });
        },
        enabled: !!userId,
        staleTime: 5 * 60 * 1000,
    });
};

/**
 * Hook to fetch Stripe products (subscription plans).
 */
export const useStripeProducts = () => {
    return useQuery({
        queryKey: ['stripe-products'],
        queryFn: async () => {
            // For now, we use the RPC we defined in SQL migration
            const { data, error } = await supabase.rpc('get_active_plans');
            if (error) throw error;

            const fetched = (data as any[]) || [];
            return fetched
                .filter(p => p.prices && p.prices.length > 0 && p.name !== 'Spy Credits')
                .sort((a, b) => {
                    const aPrice = a.prices[0]?.unit_amount || 0;
                    const bPrice = b.prices[0]?.unit_amount || 0;
                    return aPrice - bPrice;
                });
        },
        staleTime: 60 * 60 * 1000, // 1 hour
    });
};

/**
 * Hook to fetch a user's details including online status.
 */
export const useUserDetail = (userId: string) => {
    return useQuery({
        queryKey: ['user-detail', userId],
        queryFn: async () => {
            if (!userId) return null;
            const { data, error } = await supabase
                .from('users')
                .select(`
                    *,
                    user_online_status (last_seen_at)
                `)
                .eq('id', userId)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: !!userId,
        staleTime: 30 * 1000,
    });
};

/**
 * Hook to fetch connection status between two users.
 */
export const useUserConnection = (targetUserId: string, authUserId?: string) => {
    return useQuery({
        queryKey: ['user-connection', targetUserId, authUserId],
        queryFn: async () => {
            if (!targetUserId || !authUserId) return null;
            const { data, error } = await supabase
                .from('connections')
                .select('*')
                .or(`and(requester_id.eq.${authUserId},recipient_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},recipient_id.eq.${authUserId})`)
                .maybeSingle();

            if (error) throw error;
            if (!data) return null;

            const isRequester = data.requester_id === authUserId;
            return {
                ...data,
                status: data.status,
                incomingStatus: isRequester ? null : data.status,
                outgoingStatus: isRequester ? data.status : null
            };
        },
        enabled: !!targetUserId && !!authUserId,
        staleTime: 30 * 1000,
    });
};

/**
 * Hook to check if a user has spied on a profile.
 */
export const useSpiedStatus = (targetUserId: string, authUserId?: string) => {
    return useQuery({
        queryKey: ['spied-status', targetUserId, authUserId],
        queryFn: async () => {
            if (!targetUserId || !authUserId) return false;
            const { data, error } = await supabase
                .from('spied_profiles')
                .select('*')
                .eq('user_id', authUserId)
                .eq('target_user_id', targetUserId)
                .maybeSingle();

            if (error) throw error;
            return !!data;
        },
        enabled: !!targetUserId && !!authUserId,
        staleTime: 5 * 60 * 1000,
    });
};

/**
 * Hook to check if any message has been received from a specific user.
 */
export const useHasReceivedMessage = (targetUserId: string, authUserId?: string) => {
    return useQuery({
        queryKey: ['received-message', targetUserId, authUserId],
        queryFn: async () => {
            if (!targetUserId || !authUserId) return false;

            // First find the thread
            const { data: thread, error: threadError } = await supabase
                .from('threads')
                .select('id')
                .contains('participants', [targetUserId, authUserId])
                .maybeSingle();

            if (threadError) throw threadError;
            if (!thread) return false;

            // Then check for messages from targetUserId in that thread
            const { data: message, error: messageError } = await supabase
                .from('messages')
                .select('id')
                .eq('thread_id', thread.id)
                .eq('sender_id', targetUserId)
                .limit(1)
                .maybeSingle();

            if (messageError) throw messageError;
            return !!message;
        },
        enabled: !!targetUserId && !!authUserId,
        staleTime: 60 * 1000,
    });
};

/**
 * Hook to fetch message threads for a user.
 */
export const useThreads = (userId?: string) => {
    return useQuery({
        queryKey: ['threads', userId],
        queryFn: async () => {
            if (!userId) return [];

            // Fetch threads where user is a participant
            const { data: threads, error } = await supabase
                .from('threads')
                .select('*')
                .contains('participants', [userId])
                .order('last_message_time', { ascending: false });

            if (error) throw error;

            // For each thread, find the OTHER participant and get their details
            const threadsWithDetails = await Promise.all((threads || []).map(async (thread) => {
                const otherParticipantId = thread.participants.find((p: string) => p !== userId);

                if (!otherParticipantId) return { ...thread, otherUser: null };

                const { data: userData } = await supabase
                    .from('users')
                    .select('*, user_online_status(*)')
                    .eq('id', otherParticipantId)
                    .single();

                return {
                    ...thread,
                    otherUser: userData
                };
            }));

            return threadsWithDetails;
        },
        enabled: !!userId,
        refetchInterval: 30000, // Regular refresh for message updates
    });
};

/**
 * Hook to fetch messages for a specific thread and subscribe to updates.
 */
export const useMessages = (threadId?: string) => {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!threadId) return;

        // Subscribe to new messages in this thread
        const channel = supabase
            .channel(`thread:${threadId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `thread_id=eq.${threadId}`,
                },
                (payload) => {
                    // Update the cache immediately
                    queryClient.setQueryData(['messages', threadId], (old: any) => {
                        const exists = (old || []).find((m: any) => m.id === payload.new.id);
                        if (exists) return old;
                        return [...(old || []), payload.new];
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [threadId, queryClient]);

    return useQuery({
        queryKey: ['messages', threadId],
        queryFn: async () => {
            if (!threadId) return [];

            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('thread_id', threadId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data;
        },
        enabled: !!threadId,
    });
};
