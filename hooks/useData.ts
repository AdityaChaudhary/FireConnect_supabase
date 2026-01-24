import { useEffect, useState } from 'react';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.client';
import { getProcessedStripeProducts } from '../lib/stripe-utils';

/**
 * Hook to fetch users for the discovery feed.
 * Uses a seed-based randomization via RPC to preserve stable pagination.
 */
export const useDiscoveryUsers = (userId?: string, seed?: string) => {
    const PAGE_SIZE = 10;

    return useInfiniteQuery({
        queryKey: ['discovery-users', userId, seed],
        queryFn: async ({ pageParam = 0 }) => {
            if (!seed) return [];

            const { data: users, error } = await supabase.rpc('get_discovery_users', {
                p_user_id: userId,
                p_seed: seed,
                p_offset: pageParam,
                p_limit: PAGE_SIZE
            });

            if (error) {
                console.error("useDiscoveryUsers: Supabase RPC error:", error);
                throw error;
            }
            
            const fetchedUsers = (users as any[]) || [];
            console.log("useDiscoveryUsers: Fetched", fetchedUsers.length, "users with seed", seed);

            return fetchedUsers;
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) => {
            if (lastPage.length < PAGE_SIZE) return undefined;
            return allPages.length * PAGE_SIZE;
        },
        staleTime: 5 * 60 * 1000,
        enabled: !!userId && !!seed,
    });
};

/**
 * Hook to fetch all user IDs that the current user has spied on.
 */
export const useSpiedUserIds = (userId?: string) => {
    return useQuery({
        queryKey: ['spied-user-ids', userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('spied_profiles')
                .select('target_user_id')
                .eq('user_id', userId);

            if (error) throw error;
            return (data || []).map(item => item.target_user_id);
        },
        enabled: !!userId,
        staleTime: 5 * 60 * 1000,
    });
};

/**
 * Hook to fetch the number of times the current user's profile has been spied on.
 */
export const useSpyCount = (userId?: string, initialData?: number) => {
    return useQuery({
        queryKey: ['spy-count', userId],
        queryFn: async () => {
            if (!userId) return 0;
            const { count, error } = await supabase
                .from('spied_profiles')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);

            if (error) throw error;
            return count || 0;
        },
        enabled: !!userId,
        staleTime: 5 * 60 * 1000,
        initialData: initialData,
    });
};

/**
 * Hook to fetch all user connections (Connected, Pending Sent, Pending Received).
 */
export const useConnections = (userId?: string, initialData?: any) => {
    const [pollInterval, setPollInterval] = useState(60000); // Start at 60s

    const query = useQuery({
        queryKey: ['connections', userId],
        queryFn: async () => {
            console.log(`useConnections: Polling for ${userId} at ${new Date().toLocaleTimeString()}...`);
            const { data, error } = await supabase
                .from('connections')
                .select(`
                    *,
                    requester:users!connections_requester_id_fkey(*, user_online_status(last_seen_at)),
                    recipient:users!connections_recipient_id_fkey(*, user_online_status(last_seen_at))
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
        refetchInterval: pollInterval,
        initialData: initialData,
    });

    // Handle dynamic polling backoff
    useEffect(() => {
        if (!query.dataUpdatedAt || !userId) return;
        
        // Increase interval by 30s after each poll, up to 5 minutes
        setPollInterval(prev => Math.min(prev + 30000, 300000));
    }, [query.dataUpdatedAt, userId]);

    // Listen for reset events (e.g. from useThreads)
    useEffect(() => {
        if (!userId) return;
        const handleReset = () => {
            console.log("useConnections: Resetting poll interval due to activity");
            setPollInterval(60000);
        };
        window.addEventListener('reset-online-status-poll', handleReset);
        return () => window.removeEventListener('reset-online-status-poll', handleReset);
    }, [userId]);

    return query;
};

/**
 * Hook to fetch combined notifications.
 */
export const useNotifications = (userId?: string, initialData?: any) => {
    return useQuery({
        queryKey: ['notifications', userId],
        queryFn: async () => {
            if (!userId) return { notifications: [], lastCheckedAt: null };

            const { data: rpcData, error } = await supabase.rpc('get_notifications_view_data', {
                p_user_id: userId
            });

            if (error) {
                console.error("useNotifications: RPC Error:", error);
                throw error;
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
                actor_id: n.recipient_id,
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
            return {
                notifications,
                lastCheckedAt: viewData.last_checked_at
            };
        },
        staleTime: 10 * 1000,
        refetchInterval: 30000, // Fetch every 30s to keep it "automatic"
        enabled: !!userId,
        initialData: initialData,
    });
};

/**
 * Hook to fetch a user's profile images.
 */
export const useProfileImages = (userId: string, initialData?: any[]) => {
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
        initialData: initialData,
    });
};

/**
 * Hook to fetch Stripe products (subscription plans).
 */
export const useStripeProducts = (initialData?: any[]) => {
    return useQuery({
        queryKey: ['stripe-products'],
        queryFn: async () => {
            return await getProcessedStripeProducts();
        },
        staleTime: 60 * 60 * 1000, // 1 hour
        initialData: initialData,
    });
};

/**
 * Hook to fetch a user's details including online status.
 */
export const useUserDetail = (userId: string, initialData?: any) => {
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
        staleTime: 30000,
        refetchInterval: 60000, // Poll user details every 60s
        initialData: initialData,
    });
};

/**
 * Hook to fetch connection status between two users.
 */
export const useUserConnection = (targetUserId: string, authUserId?: string, initialData?: any) => {
    const queryClient = useQueryClient();

    // Sync initialData to cache when available to ensure fresh data on navigation
    useEffect(() => {
        if (initialData && targetUserId && authUserId) {
            queryClient.setQueryData(['user-connection', targetUserId, authUserId], initialData);
        }
    }, [initialData, targetUserId, authUserId, queryClient]);

    return useQuery({
        queryKey: ['user-connection', targetUserId, authUserId],
        queryFn: async () => {
            if (!targetUserId || !authUserId) return null;
            
            // Fetch ALL matching connections (could be 0, 1, or 2)
            const { data, error } = await supabase
                .from('connections')
                .select('*')
                .or(`and(requester_id.eq.${authUserId},recipient_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},recipient_id.eq.${authUserId})`);

            if (error) throw error;
            if (!data || data.length === 0) return null;

            // Logic to determine the "effective" connection status
            // 1. If any is CONNECTED, that wins.
            const connected = data.find(c => c.status === 'CONNECTED');
            if (connected) {
                const isRequester = connected.requester_id === authUserId;
                return {
                    ...connected,
                    status: 'CONNECTED',
                    incomingStatus: isRequester ? null : 'CONNECTED', // effectively connected
                    outgoingStatus: isRequester ? 'CONNECTED' : null
                };
            }

            // 2. If there is an INCOMING request (requester is THEM), that wins (so we can Accept)
            const incoming = data.find(c => c.requester_id === targetUserId && c.status === 'PENDING');
            if (incoming) {
                return {
                    ...incoming,
                    status: incoming.status,
                    incomingStatus: incoming.status,
                    outgoingStatus: null
                };
            }

            // 3. Otherwise, check for OUTGOING (requester is ME)
            const outgoing = data.find(c => c.requester_id === authUserId && c.status === 'PENDING');
            if (outgoing) {
                return {
                    ...outgoing,
                    status: outgoing.status,
                    incomingStatus: null,
                    outgoingStatus: outgoing.status
                };
            }

            return null;
        },
        enabled: !!targetUserId && !!authUserId,
        staleTime: 30 * 1000,
        initialData: initialData,
    });
};

/**
 * Hook to check if a user has spied on a profile.
 */
export const useSpiedStatus = (targetUserId: string, authUserId?: string, initialData?: boolean) => {
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
        initialData: initialData,
    });
};

/**
 * Hook to fetch detailed spied profile information for the current user.
 */
export const useSpiedProfiles = (userId?: string, initialData?: any[]) => {
    return useQuery({
        queryKey: ['spied-profiles-list', userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('spied_profiles')
                .select(`
                    target_user_id,
                    created_at,
                    target:users!target_user_id (
                        id,
                        display_name,
                        username,
                        profile_picture_url,
                        gender,
                        location,
                        bio
                    )
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        },
        enabled: !!userId,
        staleTime: 5 * 60 * 1000,
        initialData: initialData,
    });
};

/**
 * Hook to check if any message has been received from a specific user.
 */
export const useHasReceivedMessage = (targetUserId: string, authUserId?: string, initialData?: boolean) => {
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
        initialData: initialData,
    });
};

/**
 * Hook to check if there are any unread messages.
 * Lightweight query with dynamic backoff.
 */
export const useUnreadBadge = (userId?: string) => {
    const [pollInterval, setPollInterval] = useState(20000);

    const query = useQuery({
        queryKey: ['unread-badge', userId],
        queryFn: async () => {
            if (!userId) return false;
            const { data: threads, error } = await supabase
                .from('threads')
                .select('id, last_message_time, last_read, last_message_sender_id, last_message')
                .contains('participants', [userId]);

            if (error) throw error;

            const hasUnread = (threads || []).some(thread => {
                if (thread.last_message_sender_id === userId) return false;
                if (!thread.last_message || !thread.last_message_time) return false;
                
                const lastRead = thread.last_read?.[userId];
                if (!lastRead) return true;

                const lastReadTime = new Date(lastRead).getTime();
                const lastMsgTime = new Date(thread.last_message_time).getTime();
                return lastMsgTime > lastReadTime;
            });

            return hasUnread;
        },
        enabled: !!userId,
        refetchInterval: pollInterval
    });

    useEffect(() => {
        if (query.data === undefined || !userId) return;

        if (query.data) {
            setPollInterval(20000); // Reset to 20s if unread found
        } else {
            setPollInterval(prev => Math.min(prev + 10000, 120000)); // Backoff up to 2m
        }
    }, [query.data, userId]);

    return query.data || false;
};

/**
 * Hook to fetch message threads for a user.
 * Optimized with bulk user fetching and dynamic backoff.
 */
export const useThreads = (userId?: string, initialData?: any[]) => {
    const queryClient = useQueryClient();
    const [pollInterval, setPollInterval] = useState(20000);

    useEffect(() => {
        if (!userId) return;

        console.log("useThreads: Subscribing to messages for trigger", userId);
        const channel = supabase
            .channel(`message-triggers-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                },
                (payload) => {
                    console.log("useThreads: New message detected, refreshing data", payload);
                    // Refresh threads
                    queryClient.invalidateQueries({ queryKey: ['threads', userId] });
                    // Refresh online matches instantly
                    queryClient.invalidateQueries({ queryKey: ['connections', userId] });
                    // Reset polling backoff
                    window.dispatchEvent(new CustomEvent('reset-online-status-poll'));
                }
            )
            .subscribe();

        return () => {
            console.log("useThreads: Unsubscribing from message triggers for", userId);
            supabase.removeChannel(channel);
        };
    }, [userId, queryClient]);

    const query = useQuery({
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
            if (!threads || threads.length === 0) return [];

            // Optimization: Fetch all OTHER participants in one go
            const otherUserIds = threads
                .map(t => t.participants.find((p: string) => p !== userId))
                .filter((id): id is string => !!id);

            if (otherUserIds.length === 0) return threads.map(t => ({ ...t, otherUser: null }));

            const { data: usersData, error: usersError } = await supabase
                .from('users')
                .select('*, user_online_status(*)')
                .in('id', otherUserIds);

            if (usersError) throw usersError;

            const usersMap = (usersData || []).reduce((acc: any, user: any) => {
                acc[user.id] = user;
                return acc;
            }, {});

            const threadsWithDetails = threads.map((thread) => {
                const otherParticipantId = thread.participants.find((p: string) => p !== userId);
                return {
                    ...thread,
                    otherUser: otherParticipantId ? usersMap[otherParticipantId] : null
                };
            });

            return threadsWithDetails;
        },
        enabled: !!userId,
        refetchInterval: pollInterval,
        initialData: initialData,
    });

    useEffect(() => {
        if (!query.data || !userId) return;

        const hasUnread = query.data.some((thread: any) => {
            if (thread.last_message_sender_id === userId) return false;
            if (!thread.last_message || !thread.last_message_time) return false;

            const lastRead = thread.last_read?.[userId];
            if (!lastRead) return true;

            const lastReadTime = new Date(lastRead).getTime();
            const lastMsgTime = new Date(thread.last_message_time).getTime();
            return lastMsgTime > lastReadTime;
        });

        if (hasUnread) {
            setPollInterval(20000); // Reset to 20s if unread found
        } else {
            setPollInterval(prev => Math.min(prev + 10000, 120000));
        }
    }, [query.data, userId]);

    return query;
};

/**
 * Hook to fetch messages for a specific thread and subscribe to updates.
 */
export const useMessages = (threadId?: string, initialData?: any[]) => {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!threadId) return;

        // Subscribe to messages in this thread
        const channel = supabase
            .channel(`thread-messages-${threadId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'messages',
                    filter: `thread_id=eq.${threadId}`,
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['messages', threadId] });
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
        initialData: initialData,
    });
};

/**
 * Hook to fetch or create a thread ID between two users.
 */
export const useThreadId = (authUserId?: string, targetUserId?: string, initialData?: string | null) => {
    return useQuery({
        queryKey: ['thread-id', authUserId, targetUserId],
        queryFn: async () => {
            if (!authUserId || !targetUserId) return null;

            const { data, error } = await supabase
                .from('threads')
                .select('id')
                .contains('participants', [authUserId, targetUserId])
                .maybeSingle();

            if (error) throw error;
            return data?.id || null;
        },
        enabled: !!authUserId && !!targetUserId,
        staleTime: Infinity, // Thread IDs don't change
        initialData: initialData,
    });
};
