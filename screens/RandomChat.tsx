import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import CdnImage from '../components/CdnImage';
import UpgradeModal from '../components/UpgradeModal';

type ChatStatus = 'IDLE' | 'SEARCHING' | 'MATCHED';

const RandomChat: React.FC = () => {
    const navigate = useNavigate();
    const [notification, setNotification] = useState<string | null>(null);
    const { stripeRole, profile, user: authUser } = useAuth();
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    
    const [status, setStatus] = useState<ChatStatus>('IDLE');
    const [matchedUserId, setMatchedUserId] = useState<string | null>(null);
    const [matchedUser, setMatchedUser] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    // Filters
    const [genderFilter, setGenderFilter] = useState<string | null>(null); // 'MALE', 'FEMALE', null (Any)
    const [locationFilter, setLocationFilter] = useState<string | null>(profile?.location || 'IN'); // Default to Local
    
    const isPremium = stripeRole === 'pro' || stripeRole === 'max';

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Auto-clear notifications
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    // Join Pool
    const joinPool = async () => {
        if (!authUser) return;
        setStatus('SEARCHING');
        setMessages([]);
        setMatchedUserId(null);
        setMatchedUser(null);

        try {
            const { data, error } = await supabase.functions.invoke('random-chat', {
                body: { 
                    action: 'join',
                    filters: {
                        gender: genderFilter,
                        location: locationFilter
                    }
                }
            });

            if (error) throw error;

            if (data.status === 'MATCHED') {
                setStatus('MATCHED');
                setMatchedUserId(data.matched_with);
            }
        } catch (err) {
            console.error('Error joining pool:', err);
            setNotification('Failed to start searching.');
            setStatus('IDLE');
        }
    };

    // Leave Pool
    const leavePool = async () => {
        if (!authUser) return;
        try {
            await supabase.functions.invoke('random-chat', {
                body: { action: 'leave' }
            });
        } catch (err) {
            console.error('Error leaving pool:', err);
        }
        setStatus('IDLE');
        setMatchedUserId(null);
        setMatchedUser(null);
    };

    // Skip / Re-roll
    const handleSkip = async () => {
        if (!authUser) return;
        setMessages([]);
        setStatus('SEARCHING');
        setMatchedUserId(null);
        setMatchedUser(null);

        try {
            const { data, error } = await supabase.functions.invoke('random-chat', {
                body: { 
                    action: 'skip',
                    filters: {
                        gender: genderFilter,
                        location: locationFilter
                    }
                }
            });

            if (error) throw error;

            if (data.status === 'MATCHED') {
                setStatus('MATCHED');
                setMatchedUserId(data.matched_with);
            }
        } catch (err) {
            console.error('Error skipping:', err);
            setStatus('IDLE');
        }
    };

    // Heartbeat (Ping)
    useEffect(() => {
        if (status === 'IDLE') return;

        const ping = async () => {
            try {
                await supabase.functions.invoke('random-chat', {
                    body: { action: 'ping' }
                });
            } catch (err) {
                console.error('Ping failed:', err);
            }
        };

        const interval = setInterval(ping, 30000);
        return () => clearInterval(interval);
    }, [status]);

    // Cleanup on unmount or navigate away
    useEffect(() => {
        return () => {
            leavePool();
        };
    }, []);

    // Handle window close
    useEffect(() => {
        const handleUnload = () => {
            // Navigator.sendBeacon is better for this but we'll try a sync call or just rely on heartbeat
            if (authUser) {
                // Background task
                supabase.auth.getSession().then(({ data }) => {
                    const token = data.session?.access_token;
                    if (token) {
                        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/random-chat`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`,
                            },
                            body: JSON.stringify({ action: 'leave' }),
                            keepalive: true,
                        });
                    }
                });
            }
        };
        window.addEventListener('beforeunload', handleUnload);
        return () => window.removeEventListener('beforeunload', handleUnload);
    }, [authUser]);

    // Realtime Pool Subscription (to detect matches and skips)
    useEffect(() => {
        if (!authUser || status === 'IDLE') return;

        const channel = supabase
            .channel(`pool:${authUser.id}`)
            .on('postgres_changes', {
                event: '*', // Listen for all events (UPDATE, DELETE)
                schema: 'public',
                table: 'random_chat_pool',
                filter: `user_id=eq.${authUser.id}`
            }, (payload: any) => {
                console.log('Pool event received:', payload);

                if (payload.eventType === 'UPDATE') {
                    const newStatus = payload.new.status;
                    const newMatchedWith = payload.new.matched_with;

                    // Match detected
                    if (newStatus === 'MATCHED' && newMatchedWith && status === 'SEARCHING') {
                        setStatus('MATCHED');
                        setMatchedUserId(newMatchedWith);
                    }

                    // stranger skipped us or entry was reset to searching
                    if (newStatus === 'SEARCHING' && status === 'MATCHED') {
                        const strangerName = matchedUser?.display_name || 'Stranger';
                        setNotification(`${strangerName} skipped the chat!`);
                        setStatus('SEARCHING');
                        setMatchedUserId(null);
                        setMatchedUser(null);
                        setMessages([]);
                    }
                } else if (payload.eventType === 'DELETE') {
                    // Our entry was deleted (e.g., timed out or other end stopped)
                    if (status === 'MATCHED') {
                        const strangerName = matchedUser?.display_name || 'Stranger';
                        setNotification(`${strangerName} left the chat!`);
                    } else if (status === 'SEARCHING') {
                        setNotification("Session expired or ended.");
                    }
                    setStatus('IDLE');
                    setMatchedUserId(null);
                    setMatchedUser(null);
                    setMessages([]);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [authUser, status]);
    // Fetch Matched User Details
    useEffect(() => {
        if (!matchedUserId) return;

        const fetchUser = async () => {
            const { data, error } = await supabase
                .from('users')
                .select('id, username, display_name, profile_picture_url, gender')
                .eq('id', matchedUserId)
                .single();
            if (!error) setMatchedUser(data);
        };

        fetchUser();
    }, [matchedUserId]);

    // Realtime Messages Subscription
    useEffect(() => {
        if (!authUser || !matchedUserId || status !== 'MATCHED') return;

        const channel = supabase
            .channel(`random_msgs:${authUser.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages_random',
                filter: `receiver_id=eq.${authUser.id}`
            }, (payload: any) => {
                if (payload.new.sender_id === matchedUserId) {
                    setMessages(prev => [...prev, payload.new]);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [authUser, matchedUserId, status]);

    // Scroll to bottom
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newMessage.trim() || !matchedUserId || !authUser || isSending) return;

        const text = newMessage.trim();
        setNewMessage('');
        setIsSending(true);

        // Optimistic update
        const tempMsg = {
            id: Math.random().toString(),
            sender_id: authUser.id,
            receiver_id: matchedUserId,
            text,
            created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempMsg]);

        try {
            const { error } = await supabase
                .from('messages_random')
                .insert({
                    sender_id: authUser.id,
                    receiver_id: matchedUserId,
                    text
                });
            if (error) throw error;
        } catch (err) {
            console.error('Error sending message:', err);
            setNotification('Failed to send message.');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="bg-background-dark font-display antialiased h-screen flex flex-col overflow-hidden relative w-full">
            {/* Header */}
            <header className="bg-surface-dark/80 backdrop-blur-xl sticky top-0 z-30 border-b border-white/5 shadow-lg shadow-black/5 w-full">
                <div className="flex items-center justify-between p-4 max-w-md mx-auto w-full">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="flex items-center justify-center p-2 rounded-full hover:bg-white/10 transition-colors text-white group cursor-pointer"
                        >
                            <Icon name="arrow_back" className="text-[24px]" />
                        </button>
                        <h2 className="text-white text-lg font-bold">Random Chat</h2>
                    </div>
                </div>
            </header>

            {/* Main Area */}
            <main className="flex-1 overflow-y-auto flex flex-col bg-background-dark relative w-full">
                <div className="flex-1 flex flex-col px-4 py-6 max-w-md mx-auto w-full">
                    
                    {status === 'IDLE' && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-6 mt-12">
                            <div className="size-24 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                                <Icon name="shuffle" className="text-[48px] text-primary" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-white text-xl font-bold mb-2">Match with Strangers</h3>
                                <p className="text-white/40 text-sm max-w-[250px]">Click start to find someone new and start chatting instantly.</p>
                            </div>
                            <button
                                onClick={joinPool}
                                className="px-12 py-4 bg-primary text-white rounded-full font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                            >
                                Start Finding
                            </button>

                            {/* Filters UI */}
                            <div className="w-full max-w-[300px] mt-4 p-4 bg-surface-dark/50 border border-white/5 rounded-3xl flex flex-col gap-4">
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">Filter by Gender</span>
                                        {!isPremium && <Icon name="lock" className="text-[14px] text-primary" />}
                                    </div>
                                    <div className="flex gap-2">
                                        {[
                                            { label: 'Any', value: null },
                                            { label: 'Male', value: 'MALE' },
                                            { label: 'Female', value: 'FEMALE' }
                                        ].map((opt) => (
                                            <button
                                                key={opt.label}
                                                onClick={() => {
                                                    if (!isPremium && opt.value !== null) {
                                                        setIsUpgradeModalOpen(true);
                                                        return;
                                                    }
                                                    setGenderFilter(opt.value);
                                                }}
                                                className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all ${
                                                    genderFilter === opt.value 
                                                        ? 'bg-primary text-white' 
                                                        : 'bg-white/5 text-white/40 hover:bg-white/10'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">Filter by Location</span>
                                        {!isPremium && <Icon name="lock" className="text-[14px] text-primary" />}
                                    </div>
                                    <div className="flex gap-2">
                                        {[
                                            { label: 'Global', value: null },
                                            { label: 'Local', value: profile?.location || 'IN' }
                                        ].map((opt) => (
                                            <button
                                                key={opt.label}
                                                onClick={() => {
                                                    if (!isPremium && opt.value !== null) {
                                                        setIsUpgradeModalOpen(true);
                                                        return;
                                                    }
                                                    setLocationFilter(opt.value);
                                                }}
                                                className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all ${
                                                    locationFilter === opt.value 
                                                        ? 'bg-primary text-white' 
                                                        : 'bg-white/5 text-white/40 hover:bg-white/10'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                    {locationFilter && (
                                        <p className="text-[9px] text-white/30 text-center lowercase">matching with users in {locationFilter}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {status === 'SEARCHING' && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-6 mt-12">
                            <div className="relative">
                                <div className="size-24 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Icon name="person_search" className="text-[32px] text-primary/50" />
                                </div>
                            </div>
                            <div className="text-center">
                                <h3 className="text-white text-xl font-bold mb-2">Looking for someone...</h3>
                                <p className="text-white/40 text-sm">Finding you a perfect match</p>
                            </div>
                            <button
                                onClick={leavePool}
                                className="px-8 py-3 bg-white/5 text-white/50 border border-white/10 rounded-full font-bold uppercase tracking-widest hover:bg-white/10 transition-all cursor-pointer"
                            >
                                Stop
                            </button>
                        </div>
                    )}

                    {status === 'MATCHED' && (
                        <div className="flex-1 flex flex-col w-full h-full">
                            {/* Matched User Display */}
                            <div className="flex flex-col items-center justify-center py-4 border-b border-white/5 mb-4">
                                <div className="size-16 rounded-full overflow-hidden mb-2 border-2 border-primary/20">
                                    <CdnImage
                                        path={matchedUser?.profile_picture_url ?? undefined}
                                        gender={matchedUser?.gender}
                                        seed={matchedUserId ?? undefined}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <p className="text-white font-bold text-sm">{matchedUser?.display_name || 'Stranger'}</p>
                                <p className="text-green-500 text-[10px] uppercase font-black tracking-widest mt-1">Matched</p>
                            </div>

                            {/* Messages */}
                            <div ref={chatContainerRef} className="flex-1 overflow-y-auto flex flex-col gap-3 pb-4 h-full">
                                {messages.map((msg, i) => {
                                    const isMe = msg.sender_id === authUser?.id;
                                    return (
                                        <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`px-4 py-2.5 rounded-[20px] max-w-[80%] text-[15px] font-medium ${
                                                isMe ? 'bg-primary text-white rounded-br-none' : 'bg-surface-dark text-white border border-white/5 rounded-bl-none'
                                            }`}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Actions while in chat */}
                            <div className="flex gap-2 py-4">
                                <button
                                    onClick={handleSkip}
                                    className="flex-1 py-3 bg-white/5 text-white/70 border border-white/10 rounded-xl font-bold uppercase text-xs flex items-center justify-center gap-2 hover:bg-white/10 transition-all active:scale-95 cursor-pointer"
                                >
                                    <Icon name="skip_next" className="text-[20px]" />
                                    Skip
                                </button>
                                <button
                                    onClick={leavePool}
                                    className="flex-1 py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-bold uppercase text-xs flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all active:scale-95 cursor-pointer"
                                >
                                    <Icon name="stop" className="text-[20px]" />
                                    Stop
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Message Input Footer (only when matched) */}
            {status === 'MATCHED' && (
                <footer className="pb-28 pt-2 bg-gradient-to-t from-background-dark via-background-dark to-transparent z-40 w-full">
                    <div className="px-4 max-w-md mx-auto w-full">
                        <form onSubmit={handleSend} className="bg-surface-dark/95 backdrop-blur-xl rounded-[28px] p-2 shadow-2xl border border-white/5 flex items-center gap-2">
                            <input
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Type a message..."
                                className="flex-1 bg-transparent border-none focus:ring-0 text-white px-4 py-2 text-sm font-medium"
                            />
                            <button
                                type="submit"
                                disabled={!newMessage.trim() || isSending}
                                className="size-10 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-50 disabled:grayscale transition-all active:scale-90"
                            >
                                {isSending ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <Icon name="send" className="text-[20px]" />
                                )}
                            </button>
                        </form>
                    </div>
                </footer>
            )}

            {/* Notification Toast */}
            <AnimatePresence>
                {notification && (
                    <div className="fixed top-20 left-0 right-0 z-[100] flex justify-center pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-black/80 backdrop-blur-md border border-white/10 px-6 py-3 rounded-full shadow-2xl pointer-events-auto"
                        >
                            <p className="text-white text-xs font-bold">{notification}</p>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            {/* Upgrade Modal */}
            <UpgradeModal 
                isOpen={isUpgradeModalOpen} 
                onClose={() => setIsUpgradeModalOpen(false)} 
            />
        </div>
    );
};

export default RandomChat;
