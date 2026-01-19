import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import NotificationIcon from '../components/NotificationIcon';
import { useAuth } from '../context/AuthContext';
import { useConnections } from '../hooks/useData';
import CdnImage from '../components/CdnImage';
import { getDefaultAvatar } from '../lib/image-utils';
import { supabase } from '../lib/supabase';
import ConfirmDialog from '../components/ConfirmDialog';

const Matches: React.FC = () => {
    const { user: authUser } = useAuth();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const { data, isLoading: loading, refetch: fetchMatches } = useConnections(authUser?.id);

    const rawConnections = data?.connections || [];
    const rawSentRequests = data?.sentRequests || [];
    const rawReceivedRequests = data?.receivedRequests || [];

    const connections = useMemo(() => 
        rawConnections.filter((c: any) => 
            (c.display_name || c.username || '').toLowerCase().includes(searchQuery.toLowerCase())
        ), [rawConnections, searchQuery]);

    const sentRequests = useMemo(() => 
        rawSentRequests.filter((c: any) => 
            (c.display_name || c.username || '').toLowerCase().includes(searchQuery.toLowerCase())
        ), [rawSentRequests, searchQuery]);

    const receivedRequests = useMemo(() => 
        rawReceivedRequests.filter((c: any) => 
            (c.display_name || c.username || '').toLowerCase().includes(searchQuery.toLowerCase())
        ), [rawReceivedRequests, searchQuery]);

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [confirmAction, setConfirmAction] = useState<'CANCEL' | 'REJECT' | 'DISCONNECT'>('CANCEL');

    const handleAccept = async (requesterId: string) => {
        try {
            const { error } = await supabase
                .from('connections')
                .update({ status: 'CONNECTED' })
                .eq('requester_id', requesterId)
                .eq('recipient_id', authUser?.id);

            if (error) throw error;
            fetchMatches();
        } catch (error) {
            console.error("Error accepting request:", error);
        }
    };

    const handleAction = async () => {
        if (!selectedUserId || !authUser) return;

        try {
            const { error } = await supabase
                .from('connections')
                .delete()
                .or(`and(requester_id.eq.${authUser.id},recipient_id.eq.${selectedUserId}),and(requester_id.eq.${selectedUserId},recipient_id.eq.${authUser.id})`);

            if (error) throw error;
            fetchMatches();
            setIsConfirmOpen(false);
        } catch (error) {
            console.error(`Error during ${confirmAction}:`, error);
        }
    };

    const openConfirm = (userId: string, action: 'CANCEL' | 'REJECT' | 'DISCONNECT') => {
        setSelectedUserId(userId);
        setConfirmAction(action);
        setIsConfirmOpen(true);
    };

    if (loading && connections.length === 0 && sentRequests.length === 0 && receivedRequests.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center bg-background-dark">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="relative flex-1 flex flex-col w-full max-w-md mx-auto overflow-hidden bg-background-dark h-full pb-20">
            {/* Header */}
            <header className="flex items-center justify-between px-6 pt-6 pb-4 bg-background-dark sticky top-0 z-20">
                <h1 className="text-3xl font-black text-white tracking-tight">Explore</h1>
                <NotificationIcon />
            </header>

            {/* Search */}
            <div className="px-6 pb-4">
                <div className="relative group">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400 group-focus-within:text-primary transition-colors">
                        <Icon name="search" />
                    </span>
                    <input
                        className="w-full py-3.5 pl-11 pr-4 bg-white/5 border border-white/5 rounded-full text-sm font-medium placeholder-gray-500 focus:ring-1 focus:ring-primary/50 transition-all shadow-sm outline-none text-white"
                        placeholder="Search matches..."
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <main className="flex-1 overflow-y-auto px-6 space-y-4 hide-scrollbar pb-24">
                {/* Connection Requests (Received) */}
                {receivedRequests.length > 0 && (
                    <section className="py-2">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-black text-primary uppercase tracking-wider">Requests</h2>
                            <span className="px-2.5 py-1 text-[10px] font-black bg-primary/20 text-primary rounded-full uppercase tracking-widest">{receivedRequests.length} New</span>
                        </div>
                        <div className="flex flex-col gap-3">
                            {receivedRequests.map((request: any) => (
                                <div
                                    key={request.id}
                                    className="flex items-center justify-between p-3.5 rounded-[24px] bg-surface-dark border border-white/5"
                                >
                                    <div
                                        className="flex items-center gap-3 cursor-pointer"
                                        onClick={() => navigate(`/profile/${request.id}`)}
                                    >
                                        <div className="size-12 rounded-2xl relative flex items-center justify-center border border-white/10 bg-surface-dark overflow-hidden">
                                            <CdnImage
                                                path={request.profile_picture_url}
                                                gender={request.gender}
                                                seed={request.id}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white leading-tight">{request.display_name || request.username}</p>
                                            <p className="text-[10px] text-white/40 font-medium uppercase tracking-widest mt-0.5">{request.location || 'Nearby'}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleAccept(request.id)}
                                            className="size-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 active:scale-90 transition-transform"
                                        >
                                            <Icon name="check" />
                                        </button>
                                        <button
                                            onClick={() => openConfirm(request.id, 'REJECT')}
                                            className="size-10 rounded-xl bg-white/5 flex items-center justify-center text-white/50 hover:bg-white/10 active:scale-90 transition-transform"
                                        >
                                            <Icon name="close" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* People Requested (Sent) */}
                {sentRequests.length > 0 && (
                    <section className="py-2">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Sent Requests</h2>
                        </div>
                        <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar snap-x">
                            {sentRequests.map((request: any) => (
                                <div
                                    key={request.id}
                                    className="flex flex-col items-center gap-2.5 snap-start cursor-pointer group shrink-0"
                                    onClick={() => navigate(`/profile/${request.id}`)}
                                >
                                    <div className="relative size-16">
                                        <div className="w-full h-full rounded-full p-0.5 border-2 border-primary/30 flex items-center justify-center bg-surface-dark overflow-hidden">
                                            <CdnImage
                                                path={request.profile_picture_url}
                                                gender={request.gender}
                                                seed={request.id}
                                                className="w-full h-full rounded-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                                            />
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); openConfirm(request.id, 'CANCEL'); }}
                                            className="absolute -top-1 -right-1 size-6 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors"
                                        >
                                            <Icon name="close" className="text-[14px]" />
                                        </button>
                                    </div>
                                    <span className="text-[10px] font-bold text-white/30 group-hover:text-primary transition-colors truncate w-16 text-center tracking-wide">{request.display_name || request.username}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {(receivedRequests.length > 0 || sentRequests.length > 0) && connections.length > 0 && <div className="h-px bg-white/5 mb-4"></div>}

                {/* All Connections */}
                <section className="py-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-black text-white">All Connections</h3>
                    </div>

                    {connections.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center text-center">
                            <div className="size-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                <Icon name="person_search" className="text-3xl text-white/10" />
                            </div>
                            <h4 className="text-lg font-bold text-white mb-2">No connections yet</h4>
                            <p className="text-sm text-white/40 leading-relaxed mb-6 px-10">Explore people nearby and send requests to start connecting!</p>
                            <button
                                onClick={() => navigate('/')}
                                className="px-8 h-12 rounded-full bg-primary text-white font-black text-xs uppercase tracking-[0.15em] shadow-xl shadow-primary/20 active:scale-95 transition-all"
                            >
                                Discover People
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            {connections.map((user: any) => (
                                <div
                                    key={user.id}
                                    className="group relative aspect-[3/4] rounded-[32px] overflow-hidden bg-surface-dark border border-white/5 cursor-pointer shadow-xl shadow-black/40"
                                    onClick={() => navigate(`/profile/${user.id}`)}
                                >
                                    <CdnImage
                                        path={user.profile_picture_url}
                                        gender={user.gender}
                                        seed={user.id}
                                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent"></div>

                                    {/* Action Button - Top Right */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openConfirm(user.id, 'DISCONNECT');
                                        }}
                                        className="absolute top-3 right-3 size-8 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-300"
                                    >
                                        <Icon name="close" className="text-base" />
                                    </button>

                                    <div className="absolute bottom-4 left-4 right-4">
                                        <h4 className="text-base font-extrabold text-white truncate mb-2 group-hover:text-primary transition-colors leading-tight">
                                            {user.display_name || user.username}
                                        </h4>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/chat/${user.id}`, {
                                                    state: {
                                                        user: {
                                                            name: user.display_name,
                                                            avatar: user.profile_picture_url || getDefaultAvatar(user.gender),
                                                            userType: user.user_type,
                                                            isTheyMax: user.stripe_role === 'MAX' || user.user_type === 'AI'
                                                        }
                                                    }
                                                });
                                            }}
                                            className="w-full h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center gap-2 text-[10px] font-black text-white uppercase tracking-widest group-hover:bg-primary group-hover:border-primary transition-all duration-300 active:scale-95 shadow-lg shadow-black/20"
                                        >
                                            <Icon name="chat" className="text-xs" />
                                            Chat
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>

            <ConfirmDialog
                isOpen={isConfirmOpen}
                title={confirmAction === 'CANCEL' ? "Cancel Request?" : confirmAction === 'REJECT' ? "Reject Request?" : "Disconnect?"}
                message={confirmAction === 'CANCEL' ? "Are you sure you want to cancel this connection request?" : confirmAction === 'REJECT' ? "Do you want to decline this request?" : "This will remove them from your active connections."}
                confirmText={confirmAction === 'CANCEL' ? "Cancel Request" : confirmAction === 'REJECT' ? "Reject" : "Disconnect"}
                type="danger"
                onConfirm={handleAction}
                onClose={() => setIsConfirmOpen(false)}
            />
        </div>
    );
};

export default Matches;
