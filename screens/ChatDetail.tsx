import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useLoaderData } from 'react-router';
import { useSafeNavigate } from '../hooks/useSafeNavigate';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { compressImage } from '../lib/image-utils';
import { useMessages, useUserDetail, useUserConnection, useHasReceivedMessage, useThreadId, useProfileImages, useSpiedStatus } from '../hooks/useData';
import { supabase } from '../lib/supabase.client';
import { createSupabaseServerClient } from '../lib/supabase.server';
import CdnImage from '../components/CdnImage';
import EllipsisMenu from '../components/EllipsisMenu';
import EmojiPicker from '../components/EmojiPicker';
import UpgradeModal from '../components/UpgradeModal';
import type { Route } from './+types/ChatDetail';

export async function loader({ request, params }: Route.LoaderArgs) {
    const { supabase } = createSupabaseServerClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    const { id: otherUserId } = params;

    if (!user || !otherUserId) return { otherUser: null, connection: null, threadId: null, messages: [], hasReceivedMessage: false };

    // 1. Fetch other user detail
    // 2. Fetch connection status
    // 3. Fetch thread ID
    const [userRes, connRes, threadRes] = await Promise.all([
        supabase
            .from('users')
            .select('*, user_online_status (last_seen_at)')
            .eq('id', otherUserId)
            .single(),
        supabase
            .from('connections')
            .select('*')
            .or(`and(requester_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},recipient_id.eq.${user.id})`),
        supabase
            .from('threads')
            .select('id')
            .contains('participants', [user.id, otherUserId])
            .maybeSingle()
    ]);

    const otherUser = userRes.data;
    const threadId = threadRes.data?.id || null;

    // 4. Fetch messages and hasReceivedMessage if thread exists
    let messages: any[] = [];
    let hasReceivedMessage = false;

    if (threadId) {
        const [messagesRes, receivedRes] = await Promise.all([
            supabase
                .from('messages')
                .select('*')
                .eq('thread_id', threadId)
                .order('created_at', { ascending: true }),
            supabase
                .from('messages')
                .select('id')
                .eq('thread_id', threadId)
                .eq('sender_id', otherUserId)
                .limit(1)
                .maybeSingle()
        ]);
        messages = messagesRes.data || [];
        hasReceivedMessage = !!receivedRes.data;
    }

    // Process connection data (same logic as useUserConnection hook)
    let connection = null;
    const connData = connRes.data || [];
    if (connData.length > 0) {
        const connected = connData.find(c => c.status === 'CONNECTED');
        if (connected) {
            const isRequester = connected.requester_id === user.id;
            connection = {
                ...connected,
                status: 'CONNECTED',
                incomingStatus: isRequester ? null : 'CONNECTED',
                outgoingStatus: isRequester ? 'CONNECTED' : null
            };
        } else {
            const incoming = connData.find(c => c.requester_id === otherUserId && c.status === 'PENDING');
            if (incoming) {
                connection = {
                    ...incoming,
                    status: incoming.status,
                    incomingStatus: incoming.status,
                    outgoingStatus: null
                };
            } else {
                const outgoing = connData.find(c => c.requester_id === user.id && c.status === 'PENDING');
                if (outgoing) {
                    connection = {
                        ...outgoing,
                        status: outgoing.status,
                        incomingStatus: null,
                        outgoingStatus: outgoing.status
                    };
                }
            }
        }
    }

    return {
        otherUser,
        connection,
        threadId,
        messages,
        hasReceivedMessage
    };
}

const ChatDetail: React.FC = () => {
    const { id: otherUserId } = useParams<{ id: string }>();
    const loaderData = useLoaderData<typeof loader>();
    const { safeNavigate, safeBack } = useSafeNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { user: authUser, profile } = useAuth();

    // Initial user data from navigation state if available
    const initialUser = location.state?.user;

    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [showDisconnectModal, setShowDisconnectModal] = useState(false);
    const [requesting, setRequesting] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [revealedMessages, setRevealedMessages] = useState<Set<string>>(new Set());
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
    const [mediaPreviewIndex, setMediaPreviewIndex] = useState<number | null>(null);
    const [isRevealed, setIsRevealed] = useState(false);
    const [isSpying, setIsSpying] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data: otherUser, isLoading: userLoading } = useUserDetail(otherUserId || '', loaderData?.otherUser);
    const { data: connData } = useUserConnection(otherUserId || '', authUser?.id, loaderData?.connection);
    const { data: threadId, isLoading: threadLoading } = useThreadId(authUser?.id, otherUserId, loaderData?.threadId);
    const { data: messages = [] } = useMessages(threadId || undefined, loaderData?.messages);
    const { data: hasReceivedMessage } = useHasReceivedMessage(otherUserId || '', authUser?.id, loaderData?.hasReceivedMessage);
    const { data: images = [] } = useProfileImages(otherUserId || '');
    const { data: initialSpied } = useSpiedStatus(otherUserId || '', authUser?.id);
    const { refreshProfile } = useAuth();

    // Derived states
    const connectionStatus = connData?.status || null;
    const incomingStatus = connData?.incomingStatus || null;
    const outgoingStatus = connData?.outgoingStatus || null;
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
        setCurrentTime(Date.now());
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
    
    useEffect(() => {
        if (initialSpied) {
            setIsRevealed(true);
        }
    }, [initialSpied]);

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

    // Scroll to bottom when messages change
    useEffect(() => {
        if (!messages.length || !chatContainerRef.current) return;

        const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior });
            } else if (chatContainerRef.current) {
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
            }
        };

        // Use auto for the very first load to jump immediately
        const isInitialLoad = !chatContainerRef.current.getAttribute('data-loaded');
        
        if (isInitialLoad) {
            // Immediate jump
            scrollToBottom('auto');
            chatContainerRef.current.setAttribute('data-loaded', 'true');
            
            // Multiple attempts to handle staggered animations and image loading
            const timeouts = [100, 300, 600].map(delay => 
                setTimeout(() => scrollToBottom('auto'), delay)
            );
            
            return () => timeouts.forEach(clearTimeout);
        } else {
            // Smooth scroll for new messages with a slight delay for layout stabilization
            const timeoutId = setTimeout(() => {
                scrollToBottom('smooth');
            }, 150);
            return () => clearTimeout(timeoutId);
        }
    }, [messages]);

    // Mark as read effect
    useEffect(() => {
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

    // Prevent body bounce/scroll on mobile when chat is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.height = '100%';
        
        return () => {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.height = '';
        };
    }, []);

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
            
            // Invalidate queries to update connection status across the app
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['user-connection', otherUserId, authUser.id] }),
                queryClient.invalidateQueries({ queryKey: ['connections', authUser.id] })
            ]);

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
                .update({ 
                    status: 'CONNECTED',
                    updated_at: new Date().toISOString()
                })
                .eq('requester_id', otherUserId)
                .eq('recipient_id', authUser.id);
            if (error) throw error;

            // Invalidate queries to update connection status across the app
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['user-connection', otherUserId, authUser.id] }),
                queryClient.invalidateQueries({ queryKey: ['connections', authUser.id] })
            ]);

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

            // Invalidate queries to update connection status across the app
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['user-connection', otherUserId, authUser.id] }),
                queryClient.invalidateQueries({ queryKey: ['connections', authUser.id] })
            ]);

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

            // Invalidate queries to update connection status across the app
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['user-connection', otherUserId, authUser.id] }),
                queryClient.invalidateQueries({ queryKey: ['connections', authUser.id] })
            ]);

            setShowDisconnectModal(false);
            setNotification("Disconnected successfully.");
        } catch (error) {
            console.error("Error disconnecting:", error);
            setNotification("Failed to disconnect.");
        } finally {
            setRequesting(false);
        }
    };

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !threadId || !authUser) return;

        try {
            setIsSending(true);

            
            // Compress Image (same settings as profile)
            const compressed = await compressImage(file, 1080, 1080, 0.8);
            
            // Upload path: chats/{threadId}/{timestamp}_{clean_filename}
            const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '');
            const fileName = `${Date.now()}_${cleanName}`;
            const path = `chats/${threadId}/${fileName}`;
            
            const { error: uploadError } = await supabase.storage
                .from('private-media')
                .upload(path, compressed);
                
            if (uploadError) throw uploadError;
            
            // Insert Message
            const mediaUrl = `private-media/${path}`;
            const { error: msgError } = await supabase
                .from('messages')
                .insert({
                    thread_id: threadId,
                    sender_id: authUser.id,
                    text: 'Sent an image', 
                    media_url: mediaUrl,
                    type: 'image' 
                });
                
            if (msgError) throw msgError;

            // Update Thread
            await supabase
                .from('threads')
                .update({
                    last_message: 'Sent an image',
                    last_message_time: new Date().toISOString(),
                    last_message_sender_id: authUser.id
                })
                .eq('id', threadId);

            // 3. Manually invalidate queries for immediate feedback
            queryClient.invalidateQueries({ queryKey: ['messages', threadId] });
            queryClient.invalidateQueries({ queryKey: ['threads'] });

        } catch (error: any) {
            console.error('Error sending image:', error);
            setNotification(error.message || 'Failed to send image');
        } finally {
            setIsSending(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRevealClick = (e: React.MouseEvent, msgId: string) => {
        e.stopPropagation();
        setRevealedMessages(prev => {
            const newSet = new Set(prev);
            newSet.add(msgId);
            return newSet;
        });
    };

    const handleImageClick = (url: string) => {
        setPreviewImage(url);
    };

    const handleMediaRevealClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!otherUser || !authUser) return;

        const currentRole = stripeRole.toLowerCase();

        if (currentRole === 'max' || currentRole === 'pro') {
            if (isRevealed) return;

            const isPro = currentRole === 'pro';
            const currentCredits = Number(profile?.spy_credits || 0);

            if (isPro && currentCredits <= 0) {
                setShowUpgradeModal(true);
                return;
            }

            setIsSpying(true);
            try {
                const { error: spiedError } = await supabase
                    .from('spied_profiles')
                    .insert({
                        user_id: authUser.id,
                        target_user_id: otherUser.id
                    });
                if (spiedError) throw spiedError;

                if (isPro) {
                    const { error: creditsError } = await supabase
                        .from('users')
                        .update({ spy_credits: currentCredits - 1 })
                        .eq('id', authUser.id);
                    if (creditsError) throw creditsError;
                    await refreshProfile();
                }

                setIsRevealed(true);
                queryClient.setQueryData(['spied-status', otherUser.id, authUser.id], true);
                setNotification(isPro ? `Reveal successful! ${currentCredits - 1} credits remaining.` : `Unlocked with MAX benefits!`);
            } catch (error) {
                console.error("Error revealing profile", error);
                setNotification("Failed to reveal. Please try again.");
            } finally {
                setIsSpying(false);
            }
        } else {
            setShowUpgradeModal(true);
        }
    };

    const handleNextMedia = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (mediaPreviewIndex !== null && mediaPreviewIndex < images.length - 1) {
            setMediaPreviewIndex(mediaPreviewIndex + 1);
        }
    };

    const handlePrevMedia = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (mediaPreviewIndex !== null && mediaPreviewIndex > 0) {
            setMediaPreviewIndex(mediaPreviewIndex - 1);
        }
    };

    const handleMediaDragEnd = (_e: any, info: any) => {
        const swipeThreshold = 50;
        if (info.offset.x < -swipeThreshold) {
            handleNextMedia();
        } else if (info.offset.x > swipeThreshold) {
            handlePrevMedia();
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
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setIsSending(false);
        }
    };

    const handleEmojiSelect = (emoji: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = newMessage;
        const before = text.substring(0, start);
        const after = text.substring(end);

        const newText = before + emoji + after;
        setNewMessage(newText);
        // setShowEmojiPicker(false); // keep open for multiple emojis

        // Update height
        setTimeout(() => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
            
            // Set cursor position after the emoji
            const newCursorPos = start + emoji.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
            textarea.focus();
        }, 0);
    };

    const renderMessage = (msg: any, index: number) => {
        const isMe = msg.sender_id === authUser?.id;
        const showAvatar = !isMe && (index === messages.length - 1 || messages[index + 1]?.sender_id !== msg.sender_id);
        const isImage = msg.type === 'image';
        
        // Blur by default until clicked (stored in local session state)
        const isRevealed = revealedMessages.has(msg.id);
        const isBlurred = isImage && !isRevealed;

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
                            <div className="size-8 rounded-full overflow-hidden cursor-pointer border-2 border-white/10 shadow-sm" onClick={() => safeNavigate(`/profile/${otherUserId}`)}>
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
                    <div className={`relative shadow-md transition-all duration-300 overflow-hidden select-none ${
                        isImage ? 'p-0 bg-transparent' : 'px-4 py-2.5'
                    } ${isMe
                        ? `rounded-[20px] rounded-br-[4px] ${isImage ? '' : 'bg-gradient-to-tr from-primary to-pink-500 text-white shadow-primary/20'}`
                        : `rounded-[20px] rounded-bl-[4px] ${isImage ? '' : 'bg-surface-dark text-white border border-white/5'}`
                    }`}>

                        {msg.type === 'text' && (
                            <p className="text-[15px] font-medium leading-relaxed tracking-tight select-text cursor-default">{msg.text}</p>
                        )}

                        {msg.type === 'image' && msg.media_url && (
                            <div className={`relative w-full min-w-[200px] max-w-[280px] aspect-[4/5] object-cover rounded-xl overflow-hidden group/media cursor-pointer ring-1 ring-white/10 ${isMe ? 'rounded-br-none' : 'rounded-bl-none'}`}>
                                <CdnImage
                                    path={msg.media_url}
                                    className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 scale-105 ${isBlurred ? 'filter blur-xl scale-110' : ''}`}
                                    onClick={() => !isBlurred && handleImageClick(msg.media_url)}
                                />
                                {isBlurred && (
                                    <div 
                                        className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[2px] transition-all duration-500 active:bg-black/10 z-10" 
                                        onClick={(e) => {
                                             if (stripeRole === 'free') {
                                                e.stopPropagation();
                                                setShowUpgradeModal(true);
                                            } else {
                                                handleRevealClick(e, msg.id);
                                            }
                                        }}
                                    >
                                        <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full text-[11px] font-bold text-white flex items-center gap-2 border border-white/20 hover:scale-105 active:scale-95 transition-all shadow-lg">
                                            <Icon name="visibility" className="text-[16px]" /> 
                                            CLICK TO VIEW
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
        <div className="bg-background-dark font-display antialiased fixed inset-0 flex flex-col items-center overflow-hidden w-full lg:h-screen lg:p-4">
            <div className="flex flex-col w-full h-full max-w-7xl mx-auto overflow-hidden lg:rounded-[40px] lg:border lg:border-white/5 lg:bg-surface-dark lg:shadow-2xl lg:shadow-black/50">
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

                {/* Image Preview Modal */}
                <AnimatePresence>
                    {previewImage && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4"
                            onClick={() => setPreviewImage(null)}
                        >
                            <motion.button
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ delay: 0.1 }}
                                onClick={() => setPreviewImage(null)}
                                className="absolute top-4 right-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-[130]"
                            >
                                <Icon name="close" className="text-[24px]" />
                            </motion.button>
                            <div onClick={(e) => e.stopPropagation()} className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-lg shadow-2xl border border-white/10">
                                <CdnImage
                                    path={previewImage}
                                    className="w-full h-full object-contain max-h-[90vh]"
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Upgrade Modal */}
                <UpgradeModal 
                    isOpen={showUpgradeModal} 
                    onClose={() => setShowUpgradeModal(false)} 
                />

                {/* Top App Bar */}
                <header className="bg-surface-dark/80 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/5 w-full shrink-0 z-30 lg:bg-transparent lg:border-none">
                    <div className="flex items-center justify-between p-4 px-6 w-full">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => safeBack('/')}
                                className="flex items-center justify-center size-10 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white group cursor-pointer"
                            >
                                <Icon name="arrow_back" className="text-[24px] group-active:-translate-x-1 transition-transform" />
                            </button>
                            <div
                                className="flex items-center gap-3 cursor-pointer group/header"
                                onClick={() => safeNavigate(`/profile/${otherUserId}`)}
                            >
                                <div className="relative">
                                    <div className="size-11 rounded-full overflow-hidden border-2 border-primary/20 group-hover/header:border-primary transition-all duration-300 shadow-md shadow-primary/10 p-0.5">
                                        <CdnImage
                                            path={otherUser?.profile_picture_url || initialUser?.avatar}
                                            gender={otherUser?.gender}
                                            seed={otherUserId}
                                            className="w-full h-full object-cover rounded-full"
                                        />
                                    </div>
                                    {(isConnected || isTheyAI) && isOnline(otherUser?.user_online_status) && (
                                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[#1a0b12] rounded-full shadow-sm animate-pulse"></div>
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <h2 className="text-white text-base font-black leading-tight group-hover/header:text-primary transition-colors flex items-center gap-2">
                                        {displayName}
                                    </h2>
                                    {(isConnected || isTheyAI) && (
                                        isOnline(otherUser?.user_online_status) ? (
                                            <p className="text-[10px] text-green-500 font-black tracking-widest uppercase">ONLINE NOW</p>
                                        ) : (
                                            <p className="text-[10px] text-white/30 font-bold tracking-tight uppercase">{formatLastSeen(otherUser?.user_online_status)}</p>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <EllipsisMenu
                                items={[
                                    ...(isConnected ? [
                                        {
                                            label: 'Disconnect',
                                            icon: 'person_remove',
                                            variant: 'danger' as const,
                                            onClick: () => setShowDisconnectModal(true)
                                        }
                                    ] : []),
                                    {
                                        label: 'View Profile',
                                        icon: 'person',
                                        onClick: () => safeNavigate(`/profile/${otherUserId}`)
                                    },
                                    // {
                                    //     label: 'Report User',
                                    //     icon: 'flag',
                                    //     variant: 'danger' as const,
                                    //     onClick: () => { /* Handle report */ }
                                    // }
                                ]}
                            />
                        </div>
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden w-full">
                    {/* Chat Window */}
                    <main className="flex-1 flex flex-col min-w-0 bg-background-dark/30 relative">
                        {/* Chat Area Container */}
                        <div
                            ref={chatContainerRef}
                            className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-8 flex flex-col gap-4 scroll-smooth hide-scrollbar"
                        >
                            <div className="flex flex-col items-center py-10 gap-4 opacity-50">
                                <div className="size-16 rounded-full overflow-hidden border-2 border-primary/20 p-0.5">
                                    <CdnImage
                                        path={otherUser?.profile_picture_url || initialUser?.avatar}
                                        gender={otherUser?.gender}
                                        seed={otherUserId}
                                        className="w-full h-full rounded-full object-cover"
                                    />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-black uppercase tracking-widest text-white">Chat with {displayName}</p>
                                    <p className="text-[10px] font-medium text-white/40 mt-1">
                                        {isConnected ? 'You are connected' : 'Encryption active'}
                                    </p>
                                </div>
                            </div>

                            {messages.map((msg, idx) => renderMessage(msg, idx))}
                            <div ref={messagesEndRef} className="h-4 w-full shrink-0" />
                        </div>

                        {/* Messaging Input Area */}
                        <section className="shrink-0 p-4 lg:p-6 bg-gradient-to-t from-background-dark/80 via-background-dark/50 to-transparent">
                            <div className="max-w-3xl mx-auto w-full">
                                {isMessagingAllowed ? (
                                    <form
                                        onSubmit={handleSend}
                                        className="relative flex items-end gap-2 bg-surface-dark/90 backdrop-blur-xl border border-white/10 rounded-[28px] p-2 pl-4 shadow-2xl transition-all focus-within:border-primary/40 focus-within:bg-surface-dark"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="size-10 shrink-0 rounded-full flex items-center justify-center text-white/40 hover:text-primary transition-all active:scale-90"
                                        >
                                            <Icon name="add_circle" className="text-[24px]" />
                                        </button>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleImageSelect}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                        <textarea
                                            ref={textareaRef}
                                            rows={1}
                                            value={newMessage}
                                            onChange={(e) => {
                                                setNewMessage(e.target.value);
                                                e.target.style.height = 'auto';
                                                e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSend();
                                                }
                                            }}
                                            placeholder="Type a message..."
                                            className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-white text-[15px] py-3 resize-none max-h-[150px] min-h-[44px] placeholder-white/20"
                                        />
                                        <div className="flex items-center gap-1 shrink-0 px-1">
                                            <button
                                                type="button"
                                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                                className="size-10 rounded-full flex items-center justify-center text-white/20 hover:text-yellow-400 transition-all active:scale-95"
                                            >
                                                <Icon name="sentiment_satisfied" className="text-[22px]" />
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={!newMessage.trim() || isSending}
                                                className="size-10 rounded-full bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30 active:scale-90 transition-all disabled:opacity-50 disabled:grayscale btn-glow"
                                            >
                                                {isSending ? (
                                                    <div className="size-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                                ) : (
                                                    <Icon name="send" className="text-[20px] ml-1" filled />
                                                )}
                                            </button>
                                        </div>

                                        {/* Emoji Picker Overlay */}
                                        <AnimatePresence>
                                            {showEmojiPicker && (
                                                <div className="absolute bottom-full right-0 mb-4 z-50">
                                                    <EmojiPicker 
                                                        onEmojiSelect={handleEmojiSelect} 
                                                        onClose={() => setShowEmojiPicker(false)}
                                                    />
                                                </div>
                                            )}
                                        </AnimatePresence>
                                    </form>
                                ) : (
                                    <div className="bg-surface-dark border border-white/5 p-6 rounded-[32px] flex flex-col items-center text-center gap-4 shadow-xl">
                                        <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner">
                                            <Icon name={outgoingStatus === 'PENDING' ? "hourglass_empty" : "lock"} className="text-primary text-2xl" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <p className="text-white text-lg font-black tracking-tight">Messaging Restricted</p>
                                            <p className="text-white/40 text-[13px] font-medium max-w-xs mx-auto">
                                                {(outgoingStatus === 'PENDING' || isConnected)
                                                    ? `Awaiting for ${displayName} to initiate the conversation.`
                                                    : `You must connect with ${displayName} before you can start messaging.`
                                                }
                                            </p>
                                        </div>
                                        <div className="flex gap-3 w-full max-w-sm mt-2">
                                            <button
                                                onClick={() => safeNavigate(`/profile/${otherUserId}`)}
                                                className="flex-1 h-14 rounded-2xl bg-white/5 border border-white/5 font-black text-xs uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-all"
                                            >
                                                View Profile
                                            </button>
                                            {!isConnected && outgoingStatus !== 'PENDING' && (
                                                <button
                                                    onClick={handleSendRequest}
                                                    disabled={requesting}
                                                    className="flex-1 h-14 rounded-2xl bg-primary font-black text-xs uppercase tracking-widest text-white shadow-xl shadow-primary/30 btn-glow disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    {requesting ? (
                                                        <div className="size-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                                    ) : "Connect Now"}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    </main>

                    {/* Desktop Sidebar: Profile Insight */}
                    <aside className="hidden lg:flex w-[380px] shrink-0 border-l border-white/5 bg-surface-dark/30 flex flex-col overflow-y-auto hide-scrollbar">
                        <div className="p-8 flex flex-col gap-8">
                            {/* Profile Summary */}
                            <div className="flex flex-col items-center gap-5 mt-4">
                                <div className="relative group cursor-pointer" onClick={() => safeNavigate(`/profile/${otherUserId}`)}>
                                    <div className="size-36 rounded-full p-1 bg-gradient-to-tr from-primary to-purple-600 shadow-2xl shadow-primary/10 group-hover:scale-105 transition-transform duration-500">
                                        <CdnImage
                                            path={otherUser?.profile_picture_url || initialUser?.avatar}
                                            gender={otherUser?.gender}
                                            seed={otherUserId}
                                            className="w-full h-full rounded-full object-cover border-4 border-[#1a0b12]"
                                        />
                                    </div>
                                    {isOnline(otherUser?.user_online_status) && (
                                        <div className="absolute bottom-2 right-2 size-6 bg-green-500 rounded-full border-4 border-[#1d0e14] shadow-sm animate-pulse"></div>
                                    )}
                                </div>
                                <div className="text-center flex flex-col gap-1.5">
                                    <h3 className="text-3xl font-black text-white tracking-tight leading-none">{displayName}</h3>
                                    <p className="text-white/40 text-[11px] font-black tracking-[0.2em] uppercase">
                                        {(isConnected || isTheyAI) ? (isOnline(otherUser?.user_online_status) ? 'Online Now' : formatLastSeen(otherUser?.user_online_status)) : 'Not Connected'}
                                    </p>
                                </div>
                            </div>

                            {/* Quick Tags */}
                            <div className="flex flex-wrap items-center justify-center gap-2">
                                {otherUser?.location && (
                                    <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">
                                        {otherUser.location}
                                    </div>
                                )}
                                {otherUser?.gender && otherUser?.gender !== 'PREFER_NOT_TO_SAY' && (
                                    <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 text-[10px] font-black uppercase tracking-widest">
                                        {otherUser.gender}
                                    </div>
                                )}
                            </div>

                            {/* Quick Stats/Actions */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white/5 rounded-2xl p-3.5 border border-white/5 flex flex-col items-center gap-1.5 text-center shadow-inner">
                                    <Icon name="favorite" className="text-primary text-xl" filled />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Status</span>
                                    <span className="text-xs font-bold text-white/90">{isConnected ? 'Matched' : 'Pending'}</span>
                                </div>
                                <div className="bg-white/5 rounded-2xl p-3.5 border border-white/5 flex flex-col items-center gap-1.5 text-center cursor-pointer hover:bg-white/10 hover:border-primary/30 transition-all shadow-inner group"
                                    onClick={() => safeNavigate(`/profile/${otherUserId}`)}>
                                    <Icon name="person" className="text-primary text-xl group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Profile</span>
                                    <span className="text-xs font-bold text-white/90">View Bio</span>
                                </div>
                            </div>

                            {/* Media Vault Section */}
                            <div className="flex flex-col gap-6">
                                <div className="flex items-center justify-between w-full">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 ml-1 flex items-center gap-2">
                                        <Icon name="photo_library" className="text-[14px]" />
                                        Media Vault
                                    </h4>
                                    <div className="flex bg-background-dark/50 rounded-full p-1 border border-white/5 shadow-inner scale-90 origin-right">
                                        <button
                                            onClick={() => setActiveTab('PUBLIC')}
                                            className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'PUBLIC' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/40 hover:text-white/60'}`}
                                        >
                                            Public
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('PRIVATE')}
                                            className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'PRIVATE' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/40 hover:text-white/60'}`}
                                        >
                                            Private
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {images.filter(img => img.visibility === activeTab).map((img, idx) => {
                                        const isImgPrivate = img.visibility === 'PRIVATE';
                                        const showImgSpyMode = isImgPrivate && !isRevealed;

                                        return (
                                            <div
                                                key={img.id || idx}
                                                className="aspect-[3/4] rounded-2xl overflow-hidden bg-background-dark/50 relative group cursor-pointer border border-white/5 hover:border-primary/30 transition-all hover:scale-[1.02] active:scale-95 shadow-lg"
                                                onClick={() => {
                                                    const globalIndex = images.findIndex(i => i.id === img.id);
                                                    if (!showImgSpyMode) setMediaPreviewIndex(globalIndex);
                                                }}
                                            >
                                                <CdnImage
                                                    path={img.url}
                                                    className={`absolute inset-0 bg-cover bg-center transition-opacity duration-300 ${showImgSpyMode ? 'opacity-0' : 'opacity-100'}`}
                                                    useAsBackground
                                                    showSpinner={true}
                                                />

                                                {showImgSpyMode && (
                                                    <CdnImage
                                                        path={img.blurred_url || img.url}
                                                        gender={otherUser?.gender}
                                                        seed={otherUserId}
                                                        className="absolute inset-0 bg-cover bg-center blur-xl scale-110"
                                                        useAsBackground
                                                        showSpinner={true}
                                                    />
                                                )}

                                                {showImgSpyMode && (
                                                    <div
                                                        className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] z-10 group-hover:bg-black/30 transition-colors"
                                                        onClick={handleMediaRevealClick}
                                                    >
                                                        <div className="size-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20 shadow-xl group-hover:scale-110 transition-transform">
                                                            {isSpying ? (
                                                                <div className="size-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                                                            ) : (
                                                                <Icon name="visibility" className="text-white text-lg animate-pulse" />
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {isImgPrivate && !showImgSpyMode && (
                                                    <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md rounded-full p-1 border border-white/10 shadow-lg">
                                                        <Icon name="key" className="text-[10px] text-primary" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {images.filter(img => img.visibility === activeTab).length === 0 && (
                                        <div className="col-span-full py-10 flex flex-col items-center justify-center text-white/10 gap-2 bg-white/5 rounded-2xl border border-dashed border-white/5">
                                            <Icon name="no_photography" className="text-2xl" />
                                            <p className="text-[9px] font-black uppercase tracking-[0.2em]">No photos</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* About Snippet */}
                            {otherUser?.bio && (
                                <div className="flex flex-col gap-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 ml-1">Profile Bio</h4>
                                    <div className="bg-background-dark/30 rounded-3xl p-5 border border-white/5 italic shadow-inner">
                                        <p className="text-white/60 text-[13px] leading-relaxed line-clamp-6 font-medium">
                                            "{otherUser.bio}"
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </aside>
                </div>

                {/* Mobile Extra UI - Restricted Message Hook (Hidden for desktop sidebar logic but kept for functionality) */}
                {!isMessagingAllowed && (
                    <footer className="lg:hidden shrink-0 bg-background-dark p-6 text-center border-t border-white/5">
                         <p className="text-[11px] font-black uppercase tracking-[0.15em] text-white/30 leading-loose">
                            Upgrade to start chatting.<br />
                            You can always reply to received messages.
                        </p>
                        <button
                            onClick={() => safeNavigate('/subscription')}
                            className="mt-4 px-10 py-3 bg-primary text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-full shadow-xl shadow-primary/20 btn-glow"
                        >
                            Get Unlimited Access
                        </button>
                    </footer>
                )}

                {/* Disconnect Modal */}
                <AnimatePresence>
                    {showDisconnectModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
                            onClick={() => setShowDisconnectModal(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                                className="w-full max-w-sm bg-surface-dark border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="p-10 text-center">
                                    <div className="size-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                                        <Icon name="person_remove" className="text-4xl text-red-500" />
                                    </div>
                                    <h3 className="text-2xl font-black text-white mb-2 tracking-tight">Disconnect?</h3>
                                    <p className="text-white/40 text-sm font-medium mb-10 leading-relaxed">Are you sure you want to remove <span className="text-white font-bold">{displayName}</span> from your connections?</p>
                                    <div className="flex flex-col gap-3">
                                        <button
                                            onClick={handleDisconnect}
                                            disabled={requesting}
                                            className="w-full h-14 rounded-2xl bg-red-500 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-red-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {requesting ? (
                                                <div className="size-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                            ) : "Yes, Disconnect"}
                                        </button>
                                        <button
                                            onClick={() => setShowDisconnectModal(false)}
                                            className="w-full h-14 rounded-2xl bg-white/5 text-white/50 font-black text-xs uppercase tracking-widest hover:bg-white/10 active:scale-95 transition-all"
                                        >
                                            Keep Connection
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Media Vault Full Screen Modal */}
            <AnimatePresence>
                {mediaPreviewIndex !== null && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 backdrop-blur-2xl"
                        onClick={() => setMediaPreviewIndex(null)}
                    >
                        {/* Close Button */}
                        <motion.button
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => setMediaPreviewIndex(null)}
                            className="absolute top-6 right-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all z-[140] backdrop-blur-md border border-white/10"
                        >
                            <Icon name="close" className="text-[24px]" />
                        </motion.button>

                        {/* Navigation Arrows */}
                        <div className="absolute inset-y-0 left-0 w-16 md:w-24 flex items-center justify-center z-[130]">
                            {mediaPreviewIndex > 0 && (
                                <button
                                    onClick={handlePrevMedia}
                                    className="p-3 md:p-4 rounded-full bg-white/5 text-white hover:bg-white/10 transition-all border border-white/10 backdrop-blur-sm"
                                >
                                    <Icon name="chevron_left" className="text-2xl md:text-3xl" />
                                </button>
                            )}
                        </div>
                        <div className="absolute inset-y-0 right-0 w-16 md:w-24 flex items-center justify-center z-[130]">
                            {mediaPreviewIndex < images.length - 1 && (
                                <button
                                    onClick={handleNextMedia}
                                    className="p-3 md:p-4 rounded-full bg-white/5 text-white hover:bg-white/10 transition-all border border-white/10 backdrop-blur-sm"
                                >
                                    <Icon name="chevron_right" className="text-2xl md:text-3xl" />
                                </button>
                            )}
                        </div>

                        {/* Swipeable Container */}
                        <motion.div
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            onDragEnd={handleMediaDragEnd}
                            className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={mediaPreviewIndex}
                                    initial={{ opacity: 0, x: 100 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -100 }}
                                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                    className="relative w-full h-full flex items-center justify-center p-4"
                                >
                                    {(() => {
                                        const img = images[mediaPreviewIndex];
                                        const isImgPrivate = img.visibility === 'PRIVATE';
                                        const showImgSpyMode = isImgPrivate && !isRevealed;

                                        return (
                                            <div className="relative w-full h-full flex items-center justify-center">
                                                {/* Main Image */}
                                                <CdnImage
                                                    path={img.url}
                                                    gender={otherUser?.gender}
                                                    seed={otherUserId}
                                                    className={`max-h-full max-w-full object-contain rounded-xl shadow-2xl transition-opacity duration-300 ${showImgSpyMode ? 'opacity-0' : 'opacity-100'}`}
                                                    showSpinner={true}
                                                />

                                                {/* Blurred Placeholder & Spy Overlay */}
                                                {showImgSpyMode && (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
                                                        <CdnImage
                                                            path={img.blurred_url || img.url}
                                                            gender={otherUser?.gender}
                                                            seed={otherUserId}
                                                            className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-50"
                                                            useAsBackground
                                                            showSpinner={true}
                                                        />
                                                        <div
                                                            className="z-10 flex flex-col items-center gap-4 p-8 rounded-3xl bg-black/40 backdrop-blur-xl border border-white/10"
                                                            onClick={handleMediaRevealClick}
                                                        >
                                                            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 animate-pulse">
                                                                <Icon name="visibility_off" className="text-4xl text-primary" />
                                                            </div>
                                                            <div className="text-center">
                                                                <h4 className="text-xl font-bold text-white mb-1">{isSpying ? 'Unlocking...' : 'Private Photo'}</h4>
                                                                <p className="text-white/60 text-sm">{isSpying ? 'Please wait' : 'Tap to reveal this media'}</p>
                                                            </div>
                                                            {stripeRole === 'pro' && !isSpying && (
                                                                <div className="mt-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 flex items-center gap-2">
                                                                    <Icon name="stars" className="text-primary text-sm" />
                                                                    <span className="text-xs font-bold text-primary">{profile?.spy_credits || 0} Credits Left</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Visibility Badge */}
                                                {isImgPrivate && !showImgSpyMode && (
                                                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-primary/20 border border-primary/30 backdrop-blur-md flex items-center gap-2">
                                                        <Icon name="lock_open" className="text-primary text-base" />
                                                        <span className="text-xs font-bold text-primary uppercase tracking-widest">Private Revealed</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </motion.div>
                            </AnimatePresence>
                        </motion.div>

                        {/* Pagination Dots */}
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-[140]">
                            {images.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${idx === mediaPreviewIndex ? 'w-8 bg-primary shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'w-1.5 bg-white/20'}`}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Background Blur Elements */}
            <div className="absolute top-[10%] -right-20 w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full -z-10 pointer-events-none"></div>
            <div className="absolute bottom-[10%] -left-20 w-[600px] h-[600px] bg-purple-500/5 blur-[120px] rounded-full -z-10 pointer-events-none"></div>
        </div>
    );
};

export default ChatDetail;
