import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useMessages, useUserDetail } from '../hooks/useData';
import { supabase } from '../lib/supabase';
import CdnImage from '../components/CdnImage';
import { getDefaultAvatar } from '../lib/image-utils';

const ChatDetail: React.FC = () => {
    const { id: otherUserId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { user: authUser } = useAuth();

    // Initial user data from navigation state if available
    const initialUser = location.state?.user;

    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [threadId, setThreadId] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { data: otherUser } = useUserDetail(otherUserId || '');
    const { data: messages = [], isLoading: messagesLoading } = useMessages(threadId || undefined);

    // Find or create thread
    useEffect(() => {
        const getThread = async () => {
            if (!authUser || !otherUserId) return;

            const { data: thread, error } = await supabase
                .from('threads')
                .select('id')
                .contains('participants', [authUser.id, otherUserId])
                .maybeSingle();

            if (error) {
                console.error("Error fetching thread:", error);
                return;
            }

            if (thread) {
                setThreadId(thread.id);
            } else {
                const deterministicId = [authUser.id, otherUserId].sort().join('_');
                
                // Create thread if it doesn't exist
                const { data: newThread, error: createError } = await supabase
                    .from('threads')
                    .insert({
                        id: deterministicId,
                        participants: [authUser.id, otherUserId],
                        last_message: '',
                        last_message_time: new Date().toISOString()
                    })
                    .select('id')
                    .maybeSingle();

                if (createError) {
                    // If it's a conflict, it means someone else created it, just fetch it
                    if (createError.code === '23505') {
                        setThreadId(deterministicId);
                    } else {
                        console.error("Error creating thread:", createError);
                    }
                    return;
                }
                
                if (newThread) {
                    setThreadId(newThread.id);
                } else {
                    // If insert worked but didn't return (unlikely with single/maybeSingle), use the ID
                    setThreadId(deterministicId);
                }
            }
        };

        getThread();
    }, [authUser, otherUserId]);

    // Scroll to bottom when messages change and mark as read
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

        const markAsRead = async () => {
            if (!threadId || !authUser || messages.length === 0) return;

            // Optimization: check if the last message is already "read"
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.sender_id === authUser.id) return; // Don't mark as read if we sent it

            // Update last_read for current user in thread
            // We use a JSONB merge logic or just fetch and update
            const { data: thread } = await supabase
                .from('threads')
                .select('last_read')
                .eq('id', threadId)
                .single();

            const lastRead = thread?.last_read || {};
            const lastReadTime = lastRead[authUser.id];

            // If last message is newer than our last read, update it
            if (!lastReadTime || new Date(lastMessage.created_at) > new Date(lastReadTime)) {
                await supabase
                    .from('threads')
                    .update({
                        last_read: { ...lastRead, [authUser.id]: new Date().toISOString() }
                    })
                    .eq('id', threadId);
            }
        };

        markAsRead();
    }, [messages, threadId, authUser]);

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newMessage.trim() || !threadId || !authUser || isSending) return;

        const text = newMessage.trim();
        setNewMessage('');
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
                    last_message_time: new Date().toISOString()
                })
                .eq('id', threadId);

            // 3. Manually invalidate queries for immediate feedback
            queryClient.invalidateQueries({ queryKey: ['messages', threadId] });
            queryClient.invalidateQueries({ queryKey: ['threads'] });

            // 4. If AI user, call AI engine
            if (otherUser?.user_type === 'AI') {
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

    const renderMessage = (msg: any) => {
        const isMe = msg.sender_id === authUser?.id;

        return (
            <div key={msg.id} className={`flex w-full mb-4 ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe && (
                    <div className="size-8 rounded-full overflow-hidden mr-2 flex-shrink-0 self-end mb-1">
                        <CdnImage
                            path={otherUser?.profile_picture_url}
                            placeholder={getDefaultAvatar(otherUser?.gender)}
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}
                <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${isMe
                    ? 'bg-primary text-white rounded-br-none shadow-lg shadow-primary/20'
                    : 'bg-surface-dark text-white rounded-bl-none border border-white/5'
                    }`}>
                    {msg.text}
                </div>
            </div>
        );
    };

    const displayName = otherUser?.display_name || otherUser?.username || initialUser?.name || 'Chat';

    return (
        <div className="flex flex-col h-screen bg-background-dark max-w-md mx-auto relative overflow-hidden">
            {/* Header */}
            <header className="flex items-center gap-4 px-4 py-3 bg-background-dark/80 backdrop-blur-md border-b border-white/5 z-20">
                <button
                    onClick={() => navigate(-1)}
                    className="size-10 flex items-center justify-center rounded-full bg-surface-dark text-white/60 hover:text-white transition-all active:scale-90"
                >
                    <Icon name="arrow_back" />
                </button>

                <div className="flex items-center gap-3 flex-1 min-w-0" onClick={() => navigate(`/profile/${otherUserId}`)}>
                    <div className="relative">
                        <div className="size-10 rounded-full overflow-hidden border border-white/10">
                            <CdnImage
                                path={otherUser?.profile_picture_url || initialUser?.avatar}
                                placeholder={getDefaultAvatar(otherUser?.gender)}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        {otherUser?.user_online_status?.[0]?.last_seen_at && (
                            <div className="absolute bottom-0 right-0 size-3 bg-green-500 border-2 border-background-dark rounded-full"></div>
                        )}
                    </div>
                    <div className="min-w-0">
                        <h2 className="font-bold text-white truncate">{displayName}</h2>
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest leading-none">
                            {otherUser?.user_online_status?.[0]?.last_seen_at ? 'Online Now' : 'Offline'}
                        </p>
                    </div>
                </div>

                <button className="size-10 flex items-center justify-center rounded-full text-white/40">
                    <Icon name="more_vert" />
                </button>
            </header>

            {/* Messages Area */}
            <main className="flex-1 overflow-y-auto px-4 py-6 scrollbar-hide">
                {messagesLoading ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-10">
                        <div className="size-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                            <Icon name="waving_hand" className="text-3xl text-white/10" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Say Hello!</h3>
                        <p className="text-sm text-white/40">Start the conversation with {displayName}.</p>
                    </div>
                ) : (
                    <>
                        {messages.map(renderMessage)}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </main>

            {/* Input Area */}
            <footer className="p-4 bg-background-dark border-t border-white/5 pb-8">
                <form onSubmit={handleSend} className="flex items-center gap-3">
                    <button type="button" className="size-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 hover:text-primary transition-all active:scale-95">
                        <Icon name="add" className="text-xl" />
                    </button>

                    <div className="flex-1 relative">
                        <input
                            type="text"
                            placeholder="Type a message..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            className="w-full h-12 bg-surface-dark border border-white/5 rounded-2xl px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-all font-medium"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={!newMessage.trim() || isSending}
                        className={`size-12 rounded-2xl flex items-center justify-center transition-all active:scale-90 ${newMessage.trim() && !isSending ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-white/5 text-white/10'
                            }`}
                    >
                        {isSending ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <Icon name="send" className="text-xl" />
                        )}
                    </button>
                </form>
            </footer>
        </div>
    );
};

export default ChatDetail;
