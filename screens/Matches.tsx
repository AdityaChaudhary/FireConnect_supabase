import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useConnections } from '../hooks/useData';
import CdnImage from '../components/CdnImage';
import { getDefaultAvatar } from '../lib/image-utils';
import { supabase } from '../lib/supabase';
import ConfirmDialog from '../components/ConfirmDialog';

const Matches: React.FC = () => {
    const { user: authUser } = useAuth();
    const navigate = useNavigate();
    const { data, isLoading: loading, refetch: fetchMatches } = useConnections(authUser?.id);

    const connections = data?.connections || [];
    const sentRequests = data?.sentRequests || [];
    const receivedRequests = data?.receivedRequests || [];

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
                <h1 className="text-3xl font-black text-white tracking-tight">Connections</h1>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white/40">
                    <Icon name="people" />
                </div>
            </header>

            <main className="flex-1 overflow-y-auto px-6 space-y-8 scrollbar-hide pb-12">
                {/* Pending Requests Section */}
                {(receivedRequests.length > 0 || sentRequests.length > 0) && (
                    <section className="space-y-4">
                        <div className="flex items-center gap-2">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Pending Requests</h3>
                            <div className="h-px flex-1 bg-white/5"></div>
                            <span className="text-[10px] font-bold text-primary">{receivedRequests.length + sentRequests.length}</span>
                        </div>

                        <div className="space-y-3">
                            {receivedRequests.map((user: any) => (
                                <div key={user.id} className="flex items-center gap-4 p-4 rounded-3xl bg-surface-dark border border-white/5">
                                    <div className="relative cursor-pointer" onClick={() => navigate(`/profile/${user.id}`)}>
                                        <div className="size-14 rounded-2xl overflow-hidden bg-white/5">
                                            <CdnImage
                                                path={user.profile_picture_url}
                                                placeholder={getDefaultAvatar(user.gender)}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-primary border-2 border-surface-dark flex items-center justify-center">
                                            <Icon name="arrow_downward" className="text-[10px] text-white" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0" onClick={() => navigate(`/profile/${user.id}`)}>
                                        <h4 className="text-sm font-bold text-white truncate">{user.display_name || user.username}</h4>
                                        <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Wants to connect</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => openConfirm(user.id, 'REJECT')}
                                            className="size-10 rounded-xl bg-white/5 text-white/40 hover:bg-red-500/10 hover:text-red-400 transition-all flex items-center justify-center"
                                        >
                                            <Icon name="close" className="text-lg" />
                                        </button>
                                        <button
                                            onClick={() => handleAccept(user.id)}
                                            className="size-10 rounded-xl bg-primary text-white shadow-lg shadow-primary/20 flex items-center justify-center active:scale-90 transition-all"
                                        >
                                            <Icon name="check" className="text-lg" />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {sentRequests.map((user: any) => (
                                <div key={user.id} className="flex items-center gap-4 p-4 rounded-3xl bg-surface-dark/50 border border-white/5 opacity-80">
                                    <div className="relative cursor-pointer" onClick={() => navigate(`/profile/${user.id}`)}>
                                        <div className="size-14 rounded-2xl overflow-hidden bg-white/5">
                                            <CdnImage
                                                path={user.profile_picture_url}
                                                placeholder={getDefaultAvatar(user.gender)}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-white/10 border-2 border-surface-dark flex items-center justify-center">
                                            <Icon name="arrow_upward" className="text-[10px] text-white/40" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0" onClick={() => navigate(`/profile/${user.id}`)}>
                                        <h4 className="text-sm font-bold text-white/60 truncate">{user.display_name || user.username}</h4>
                                        <p className="text-[10px] text-white/30 font-medium uppercase tracking-wider">Request Sent</p>
                                    </div>
                                    <button
                                        onClick={() => openConfirm(user.id, 'CANCEL')}
                                        className="h-9 px-4 rounded-xl bg-white/5 text-white/40 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Connections Grid */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Your Connections</h3>
                        <div className="h-px flex-1 bg-white/5"></div>
                        <span className="text-[10px] font-bold text-primary">{connections.length}</span>
                    </div>

                    {connections.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center text-center px-10">
                            <div className="size-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                <Icon name="person_search" className="text-3xl text-white/10" />
                            </div>
                            <h4 className="text-lg font-bold text-white mb-2">No connections yet</h4>
                            <p className="text-sm text-white/40 leading-relaxed mb-6">Explore people nearby and send requests to start connecting!</p>
                            <button
                                onClick={() => navigate('/discover')}
                                className="px-8 h-12 rounded-full bg-primary text-white font-bold text-sm shadow-xl shadow-primary/20 active:scale-95 transition-all"
                            >
                                Discover People
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            {connections.map((user: any) => (
                                <div
                                    key={user.id}
                                    className="group relative aspect-[4/5] rounded-[32px] overflow-hidden bg-surface-dark border border-white/5 cursor-pointer shadow-xl"
                                    onClick={() => navigate(`/profile/${user.id}`)}
                                >
                                    <CdnImage
                                        path={user.profile_picture_url}
                                        placeholder={getDefaultAvatar(user.gender)}
                                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>

                                    {/* Connection Label */}
                                    <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-primary/20 backdrop-blur-md border border-primary/30 flex items-center gap-1.5">
                                        <Icon name="link" className="text-[10px] text-primary" />
                                        <span className="text-[8px] font-black text-primary uppercase tracking-widest">Connected</span>
                                    </div>

                                    <div className="absolute bottom-4 left-4 right-4">
                                        <h4 className="text-base font-bold text-white truncate mb-1">
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
                                            className="w-full h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center gap-2 text-[10px] font-bold text-white uppercase tracking-wider group-hover:bg-primary group-hover:border-primary transition-all"
                                        >
                                            <Icon name="chat" className="text-xs" />
                                            Message
                                        </button>
                                    </div>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openConfirm(user.id, 'DISCONNECT');
                                        }}
                                        className="absolute top-3 right-3 size-8 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Icon name="close" className="text-base" />
                                    </button>
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
