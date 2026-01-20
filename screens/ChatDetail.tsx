import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useMessages, useUserDetail, useUserConnection, useSpiedStatus, useHasReceivedMessage, useThreadId } from '../hooks/useData';
import { supabase } from '../lib/supabase';
import CdnImage from '../components/CdnImage';
import EllipsisMenu from '../components/EllipsisMenu';

const ChatDetail: React.FC = () => {
    const { id: otherUserId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { user: authUser, profile, refreshProfile } = useAuth();

    // Initial user data from navigation state if available
    const initialUser = location.state?.user;

    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [showDisconnectModal, setShowDisconnectModal] = useState(false);
    const [requesting, setRequesting] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const { data: otherUser, isLoading: userLoading } = useUserDetail(otherUserId || '');
    const { data: connData, refetch: refetchConn } = useUserConnection(otherUserId || '', authUser?.id);
    const { data: threadId, isLoading: threadLoading } = useThreadId(authUser?.id, otherUserId);
    const { data: messages = [] } = useMessages(threadId || undefined);
    const { data: isSpied } = useSpiedStatus(otherUserId || '', authUser?.id);
    const { data: hasReceivedMessage } = useHasReceivedMessage(otherUserId || '', authUser?.id);

    // Derived states
    const connectionStatus = connData?.status || null;
    const incomingStatus = connData?.incomingStatus || null;
    const stripeRole = (profile?.stripe_role || 'FREE').toLowerCase();
    const isTheyAI = otherUser?.user_type === 'AI';
    
    const isOnline = (status?: any) => {
        if (!status) return false;
        // Handle if status is just the timestamp string
        if (typeof status === 'string') {
            const lastSeen = new Date(status).getTime();
            return (currentTime - lastSeen) < 300000;
        }
        // Handle if status is the object or array from the query
        const lastSeenAt = Array.isArray(status) ? status[0]?.last_seen_at : status?.last_seen_at;
        if (!lastSeenAt) return false;
        const lastSeen = new Date(lastSeenAt).getTime();
        return (currentTime - lastSeen) < 300000; // 5 minute threshold
    };

    const formatLastSeen = (status?: any) => {
        const lastSeenAt = Array.isArray(status) ? status[0]?.last_seen_at : status?.last_seen_at;
        if (!lastSeenAt) return '';
        const lastSeen = new Date(lastSeenAt).getTime();
        const diff = Math.floor((currentTime - lastSeen) / 1000); 
        
        const lastSeenMsg = 'Last seen ';
        
        if (diff < 120) return lastSeenMsg + 'Just now';
        if (diff < 3600) return lastSeenMsg + `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return lastSeenMsg + `${Math.floor(diff / 3600)}h ago`;
        return lastSeenMsg + `${Math.floor(diff / 86400)}d ago`;
    };

    useEffect(() => {
        const intervalId = setInterval(() => {
            setCurrentTime(Date.now());
        }, 10000); // Update every 10 seconds
        return () => clearInterval(intervalId);
    }, []);

    // Notification timeout
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => timer && clearTimeout(timer);
        }
    }, [notification]);

    // Ensure thread exists in background if not found by hook
    useEffect(() => {
        const ensureThread = async () => {
            if (!authUser || !otherUserId || threadLoading || threadId) return;

            const deterministicId = [authUser.id, otherUserId].sort().join('_');
            
            // Create thread if it doesn't exist
            const { error: createError } = await supabase
                .from('threads')
                .upsert({
                    id: deterministicId,
                    participants: [authUser.id, otherUserId],
                    last_message: '',
                    last_message_time: new Date().toISOString()
                }, { onConflict: 'id' });

            if (createError) {
                console.error("Error ensuring thread exists:", createError);
            } else {
                // Invalidate to let the hook pick it up
                queryClient.invalidateQueries({ queryKey: ['thread-id', authUser.id, otherUserId] });
            }
        };

        ensureThread();
    }, [authUser, otherUserId, threadId, threadLoading, queryClient]);

    // Scroll to bottom when messages change and mark as read
    // Mark as read when thread is loaded or messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

        const markAsRead = async () => {
            if (!threadId || !authUser) return;

            // Fetch latest thread state to get last_message_time and current last_read
            const { data: thread } = await supabase
                .from('threads')
                .select('last_message_time, last_message_sender_id, last_read')
                .eq('id', threadId)
                .single();

            if (!thread || !thread.last_message_time) return;

            // Don't mark as read if we were the last sender
            if (thread.last_message_sender_id === authUser.id) return;

            const lastRead = thread.last_read || {};
            const lastReadTime = lastRead[authUser.id];

            // If never read or last message is newer than our last read, update it
            if (!lastReadTime || new Date(thread.last_message_time) > new Date(lastReadTime)) {
                const now = new Date().toISOString();
                const { error } = await supabase
                    .from('threads')
                    .update({
                        last_read: { ...lastRead, [authUser.id]: now }
                    })
                    .eq('id', threadId);

                if (!error) {
                    // Invalidate threads query so ChatList updates immediately
                    queryClient.invalidateQueries({ queryKey: ['threads'] });
                }
            }
        };

        markAsRead();
    }, [messages, threadId, authUser, queryClient]);

    const handleSendRequest = async () => {
        if (!otherUserId || !authUser || requesting) return;
        setRequesting(true);
        try {
            const { error } = await supabase
                .from('connections')
                .insert({
                    requester_id: authUser.id,
                    recipient_id: otherUserId,
                    status: 'PENDING'
                });
            if (error) throw error;
            refetchConn();
            setNotification("Connection request sent!");
        } catch (error) {
            console.error("Error sending connection request:", error);
            setNotification("Failed to send request.");
        } finally {
            setRequesting(false);
        }
    };

    const handleAcceptRequest = async () => {
        if (!otherUserId || !authUser || requesting) return;
        setRequesting(true);
        try {
            const { error } = await supabase
                .from('connections')
                .update({ status: 'CONNECTED' })
                .eq('requester_id', otherUserId)
                .eq('recipient_id', authUser.id);
            if (error) throw error;
            refetchConn();
            setNotification("Connection accepted!");
        } catch (error) {
            console.error("Error accepting connection request:", error);
            setNotification("Failed to accept request.");
        } finally {
            setRequesting(false);
        }
    };

    const handleCancelRequest = async () => {
        if (!otherUserId || !authUser || requesting) return;
        setRequesting(true);
        try {
            const { error } = await supabase
                .from('connections')
                .delete()
                .eq('requester_id', authUser.id)
                .eq('recipient_id', otherUserId);
            if (error) throw error;
            refetchConn();
            setNotification("Request cancelled.");
        } catch (error) {
            console.error("Error cancelling request:", error);
        } finally {
            setRequesting(false);
        }
    };

    const handleDisconnect = async () => {
        if (!otherUserId || !authUser || requesting) return;
        setRequesting(true);
        try {
            const { error } = await supabase
                .from('connections')
                .delete()
                .or(`and(requester_id.eq.${authUser.id},recipient_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},recipient_id.eq.${authUser.id})`);
            
            if (error) throw error;
            refetchConn();
            setShowDisconnectModal(false);
            setNotification("Disconnected successfully.");
        } catch (error) {
            console.error("Error disconnecting:", error);
            setNotification("Failed to disconnect.");
        } finally {
            setRequesting(false);
        }
    };

    const handleRevealClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!otherUserId || !authUser) return;

        if (stripeRole === 'max') {
            // Already handled by RLS if Max
            return;
        }

        if (stripeRole === 'pro') {
            if (isSpied) return;

            const currentCredits = Number(profile?.spy_credits || 0);
            if (currentCredits > 0) {
                try {
                    // Start a transaction-like update
                    const { error: spyError } = await supabase
                        .from('spied_profiles')
                        .insert({
                            user_id: authUser.id,
                            target_user_id: otherUserId
                        });
                    
                    if (spyError) throw spyError;

                    const { error: creditError } = await supabase
                        .from('users')
                        .update({ spy_credits: currentCredits - 1 })
                        .eq('id', authUser.id);
                    
                    if (creditError) throw creditError;

                    await refreshProfile();
                    queryClient.invalidateQueries({ queryKey: ['spied-status', otherUserId] });
                    setNotification(`Reveal successful! ${currentCredits - 1} credits remaining.`);
                } catch (error) {
                    console.error("Error revealing profile:", error);
                    setNotification("Failed to reveal. Please try again.");
                }
            } else {
                setNotification("Not enough credits to reveal. Buy more credits!");
            }
        } else {
            setNotification("Upgrade to Pro to reveal private photos.");
        }
    };

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newMessage.trim() || !threadId || !authUser || isSending) return;

        const text = newMessage.trim();
        setNewMessage('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
        setIsSending(true);

        try {
            // 1. Insert message
            const { error: msgError } = await supabase
                .from('messages')
                .insert({
                    thread_id: threadId,
                    sender_id: authUser.id,
                    text: text,
                    type: 'text'
                });

            if (msgError) throw msgError;

            // 2. Update thread
            await supabase
                .from('threads')
                .update({
                    last_message: text,
                    last_message_time: new Date().toISOString(),
                    last_message_sender_id: authUser.id
                })
                .eq('id', threadId);

            // 3. Manually invalidate queries for immediate feedback
            queryClient.invalidateQueries({ queryKey: ['messages', threadId] });
            queryClient.invalidateQueries({ queryKey: ['threads'] });

            // 4. If AI user, call AI engine
            if (isTheyAI) {
                try {
                    await supabase.functions.invoke('ai-engine', {
                        body: {
                            threadId: threadId,
                            text: text,
                            userId: authUser.id,
                            targetUserId: otherUserId
                        }
                    });
                } catch (aiError) {
                    console.error("AI Engine error:", aiError);
                }
            }
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setIsSending(false);
        }
    };

    const renderMessage = (msg: any, index: number) => {
        const isMe = msg.sender_id === authUser?.id;
        const showAvatar = !isMe && (index === messages.length - 1 || messages[index + 1]?.sender_id !== msg.sender_id);
        const isBlurred = msg.type === 'image' && msg.is_private && !isMe && !isSpied && stripeRole !== 'max';

        return (
            <motion.div
                key={msg.id || index}
                layout
                initial={{ 
                    opacity: 0, 
                    y: 20, 
                    scale: 0.8,
                    originX: isMe ? 1 : 0 
                }}
                animate={{ 
                    opacity: 1, 
                    y: 0, 
                    scale: 1 
                }}
                transition={{ 
                    type: "spring", 
                    damping: 25, 
                    stiffness: 400, 
                    delay: Math.min(index * 0.03, 0.5), // Cap the stagger
                    mass: 0.8
                }}
                className={`flex items-end gap-2.5 max-w-[85%] group ${isMe ? 'self-end justify-end ml-auto' : 'self-start mr-auto'}`}
            >
                {!isMe && (
                    <div className="w-8 flex-shrink-0 flex justify-center">
                        {showAvatar ? (
                            <div className="size-8 rounded-full overflow-hidden cursor-pointer border-2 border-white/10 shadow-sm" onClick={() => navigate(`/profile/${otherUserId}`)}>
                                <CdnImage
                                    path={otherUser?.profile_picture_url}
                                    gender={otherUser?.gender}
                                    seed={otherUserId}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ) : <div className="w-8" />}
                    </div>
                )}

                <div className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`relative px-4 py-2.5 shadow-md transition-all duration-300 ${isMe
                        ? 'rounded-[20px] rounded-br-[4px] bg-gradient-to-tr from-primary to-pink-500 text-white shadow-primary/20'
                        : 'rounded-[20px] rounded-bl-[4px] bg-surface-dark text-white border border-white/5'
                        }`}>

                        {msg.type === 'text' && (
                            <p className="text-[15px] font-medium leading-relaxed tracking-tight">{msg.text}</p>
                        )}

                        {msg.type === 'image' && msg.media_url && (
                            <div className="relative w-full min-w-[200px] max-w-[280px] aspect-[4/5] rounded-xl overflow-hidden mb-2 group/media cursor-pointer ring-1 ring-white/10">
                                <CdnImage
                                    path={msg.media_url}
                                    className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 scale-105 ${isBlurred ? 'filter blur-md' : ''}`}
                                />
                                {isBlurred && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all duration-500 active:bg-black/20" onClick={handleRevealClick}>
                                        <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full text-[11px] font-bold text-white flex items-center gap-2 border border-white/20 active:scale-95 transition-all">
                                            <Icon name="visibility" className="text-[16px]" /> REVEAL PHOTO
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity px-1">
                        <span className="text-[10px] uppercase font-bold tracking-tighter text-white/40">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMe && (
                             <Icon 
                                name="done_all" 
                                className="text-[12px] text-primary" 
                             />
                        )}
                    </div>
                </div>
            </motion.div>
        );
    };

    const displayName = otherUser?.display_name || otherUser?.username || initialUser?.name || 'Chat';
    const isConnected = connectionStatus === 'CONNECTED' || incomingStatus === 'CONNECTED';
    
    // Messaging Restrictions
    const isTheyHuman = otherUser?.user_type === 'HUMAN';
    
    const isMessagingAllowed = 
        hasReceivedMessage || // Always allow replying
        stripeRole === 'max' || 
        (stripeRole === 'pro' && isConnected) || 
        (stripeRole === 'free' && isConnected && isTheyHuman);

    const isInitialLoading = userLoading && !otherUser;

    if (isInitialLoading) {
        return (
            <div className="min-h-screen w-full bg-background-dark flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="bg-background-dark font-display antialiased h-screen flex flex-col overflow-hidden relative max-w-md mx-auto">
            {/* Notification */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: -20, x: '-50%' }}
                        className="absolute top-20 left-1/2 z-[100] bg-black/80 backdrop-blur-md border border-white/10 px-6 py-3 rounded-full shadow-2xl"
                    >
                        <p className="text-white text-sm font-bold tracking-tight">{notification}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Top App Bar */}
            <header className="flex items-center justify-between p-4 bg-surface-dark/80 backdrop-blur-xl sticky top-0 z-30 border-b border-white/5 shadow-lg shadow-black/5">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center justify-center p-2 rounded-full hover:bg-white/10 transition-colors text-white group cursor-pointer"
                    >
                        <Icon name="arrow_back" className="text-[24px] group-active:-translate-x-1 transition-transform" />
                    </button>
                    <div
                        className="flex items-center gap-3 cursor-pointer group/header"
                        onClick={() => navigate(`/profile/${otherUserId}`)}
                    >
                        <div className="relative">
                            <div className="size-10 rounded-full overflow-hidden border-2 border-primary/20 group-hover/header:border-primary transition-all duration-300 shadow-md shadow-primary/10">
                                <CdnImage
                                    path={otherUser?.profile_picture_url || initialUser?.avatar}
                                    gender={otherUser?.gender}
                                    seed={otherUserId}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            {(isConnected || isTheyAI) && isOnline(otherUser?.user_online_status) && (
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background-dark rounded-full shadow-sm animate-pulse"></div>
                            )}
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-white text-sm font-bold leading-tight group-hover/header:text-primary transition-colors flex items-center gap-1">
                                {displayName}
                            </h2>
                            {(isConnected || isTheyAI) && (
                                isOnline(otherUser?.user_online_status) ? (
                                    <p className="text-[10px] text-green-500 font-black tracking-wide">ONLINE NOW</p>
                                ) : (
                                    <p className="text-[10px] text-white/30 font-medium tracking-wide uppercase">{formatLastSeen(otherUser?.user_online_status)}</p>
                                )
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <EllipsisMenu
                        items={[
                            ...(isConnected ? [
                                {
                                    label: 'Disconnect',
                                    icon: 'person_remove',
                                    variant: 'danger' as const,
                                    onClick: () => setShowDisconnectModal(true)
                                }
                            ] : [
                                ...(incomingStatus === 'PENDING' ? [
                                    {
                                        label: 'Accept Request',
                                        icon: 'person_add',
                                        onClick: handleAcceptRequest
                                    }
                                ] : connectionStatus === 'PENDING' ? [
                                    {
                                        label: 'Cancel Request',
                                        icon: 'hourglass_empty',
                                        onClick: handleCancelRequest
                                    }
                                ] : [
                                    {
                                        label: 'Send Request',
                                        icon: 'person_add',
                                        onClick: handleSendRequest
                                    }
                                ])
                            ])
                        ]}
                    />
                </div>
            </header>

            {/* Chat Area */}
            <main className="flex-1 overflow-y-auto px-4 py-6 flex flex-col bg-background-dark scrollbar-hide relative">
                <div className="flex flex-col items-center justify-center my-8">
                    <div className="size-16 rounded-full overflow-hidden mb-3 ring-4 ring-primary/10 shadow-xl border-2 border-primary/20">
                        <CdnImage
                            path={otherUser?.profile_picture_url || initialUser?.avatar}
                            gender={otherUser?.gender}
                            seed={otherUserId}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <p className="text-[11px] text-white/30 bg-white/5 border border-white/5 px-4 py-1.5 rounded-full uppercase tracking-widest font-bold backdrop-blur-sm">
                        Conversation started
                    </p>
                    {!isConnected && (
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                                if (incomingStatus === 'PENDING') handleAcceptRequest();
                                else if (connectionStatus === 'PENDING') handleCancelRequest();
                                else handleSendRequest();
                            }}
                            disabled={requesting}
                            className={`mt-4 px-6 py-2 rounded-full text-[12px] font-black uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 cursor-pointer ${incomingStatus === 'PENDING'
                                ? 'bg-green-500 text-white shadow-green-500/20'
                                : connectionStatus === 'PENDING'
                                    ? 'bg-white/10 text-white/50 border border-white/10'
                                    : 'bg-gradient-to-r from-primary to-pink-500 text-white shadow-primary/20'
                                }`}
                        >
                            {requesting ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <Icon name={
                                        incomingStatus === 'PENDING' ? 'person_add' :
                                            connectionStatus === 'PENDING' ? 'hourglass_empty' : 'person_add'
                                    } className="text-[18px]" />
                                    {incomingStatus === 'PENDING' ? 'Accept Request' :
                                        connectionStatus === 'PENDING' ? 'Cancel Request' : 'Send Request'}
                                </>
                            )}
                        </motion.button>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <AnimatePresence initial={false}>
                        {messages.map(renderMessage)}
                    </AnimatePresence>
                </div>
                
                {!isMessagingAllowed && messages.length > 0 && (
                    <div className="flex flex-col items-center justify-center my-8">
                        <p className="text-[11px] text-red-500 bg-red-500/5 border border-red-500/20 px-4 py-1.5 rounded-full uppercase tracking-widest font-bold backdrop-blur-sm">
                            Conversation restricted
                        </p>
                    </div>
                )}

                <div ref={messagesEndRef} className="h-4" />
            </main>

            {/* Footer Input */}
            {isMessagingAllowed ? (
                <footer className="px-4 pb-10 pt-2 bg-gradient-to-t from-background-dark via-background-dark to-transparent z-40">
                    <div className="max-w-4xl mx-auto bg-surface-dark/95 backdrop-blur-xl rounded-[28px] p-2 shadow-2xl shadow-black/20 border border-white/5 transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/30">
                        <div className="flex items-end gap-1">
                            <div className="flex items-center">
                                <button className="flex items-center justify-center w-10 h-10 rounded-full text-white/20 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer">
                                    <Icon name="add_circle" className="text-[24px]" />
                                </button>
                                <button className="flex items-center justify-center w-10 h-10 rounded-full text-white/20 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer">
                                    <Icon name="photo_camera" className="text-[22px]" />
                                </button>
                            </div>

                            <div className="flex-1 px-2 py-2">
                                <textarea
                                    ref={textareaRef}
                                    className="w-full bg-transparent border-0 p-0 text-white placeholder-white/20 focus:ring-0 resize-none text-[15px] leading-6 max-h-[120px] scrollbar-hide font-medium"
                                    placeholder="Write your message..."
                                    rows={1}
                                    value={newMessage}
                                    onChange={(e) => {
                                        setNewMessage(e.target.value);
                                        e.target.style.height = 'auto';
                                        e.target.style.height = e.target.scrollHeight + 'px';
                                    }}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                ></textarea>
                            </div>

                            <div className="flex items-center">
                                <button className="flex items-center justify-center w-10 h-10 rounded-full text-white/20 hover:text-yellow-500 hover:bg-yellow-500/5 transition-all cursor-pointer">
                                    <Icon name="sentiment_satisfied" className="text-[22px]" />
                                </button>
                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleSend()}
                                    className={`flex items-center justify-center w-11 h-11 rounded-[20px] transition-all cursor-pointer ${newMessage.trim()
                                        ? 'bg-primary text-white shadow-lg shadow-primary/30'
                                        : 'bg-white/5 text-white/10'}`}
                                >
                                    <Icon name="send" className={`text-[20px] transition-all ${newMessage.trim() ? 'ml-0.5 rotate-0' : 'rotate-[-45deg]'}`} />
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </footer>
            ) : (
                <footer className="px-4 pb-12 pt-4 bg-background-dark flex flex-col items-center justify-center text-center gap-2 z-40 border-t border-white/5">
                    <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mb-1">
                        <Icon name="lock" className="text-primary text-xl" />
                    </div>
                    <h3 className="text-white font-bold text-sm tracking-tight">
                        {(!isConnected && (stripeRole === 'pro' || stripeRole === 'free')) ? 'Connection Required' : 'Initiation Locked'}
                    </h3>
                    <p className="text-white/40 text-[11px] max-w-[280px] leading-relaxed">
                        {(!isConnected && (stripeRole === 'pro' || stripeRole === 'free')) ? (
                            <>Connect with <span className="text-primary font-bold">{displayName}</span> to start messaging.</>
                        ) : (
                            <>Only <span className="text-primary font-bold">MAX</span> users can initiate conversations with anyone.</>
                        )}
                        <br />
                        You can always reply to messages received.
                    </p>
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/subscription')}
                        className="mt-3 px-8 py-2.5 bg-primary text-white text-[11px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-primary/20 transition-all cursor-pointer"
                    >
                        {(!isConnected && (stripeRole === 'pro' || stripeRole === 'free')) ? 'View Subscription' : 'Upgrade to Max'}
                    </motion.button>
                </footer>
            )}

            {/* Disconnect Modal */}
            <AnimatePresence>
                {showDisconnectModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowDisconnectModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="w-full max-w-sm bg-surface-dark border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-8 text-center">
                                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Icon name="person_remove" className="text-4xl text-red-500" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">Disconnect?</h3>
                                <p className="text-white/60 mb-8">Are you sure you want to remove {displayName} from your connections?</p>
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={handleDisconnect}
                                        className="w-full h-14 rounded-2xl bg-red-500 text-white font-bold shadow-lg shadow-red-500/20 active:scale-95 transition-all cursor-pointer"
                                    >
                                        Yes, Disconnect
                                    </button>
                                    <button
                                        onClick={() => setShowDisconnectModal(false)}
                                        className="w-full h-14 rounded-2xl bg-white/5 text-white/50 font-bold hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Animated Background Elements */}
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/5 blur-[120px] rounded-full -z-10 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-purple-500/5 blur-[120px] rounded-full -z-10 pointer-events-none"></div>
        </div>
    );
};

export default ChatDetail;
