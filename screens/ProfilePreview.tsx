import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import EllipsisMenu from '../components/EllipsisMenu';
import UpgradeModal from '../components/UpgradeModal';
import { useUserDetail, useUserConnection, useProfileImages, useSpiedStatus, useHasReceivedMessage } from '../hooks/useData';
import { getDefaultAvatar } from '../lib/image-utils';
import CdnImage from '../components/CdnImage';
import { supabase } from '../lib/supabase';

const ProfilePreview: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user: authUser, profile: myProfile, refreshProfile } = useAuth();
    const stripeRole = myProfile?.stripe_role || 'FREE';

    // React Query Hooks
    const targetUserId = id || '';
    const { data: user, isLoading: userLoading } = useUserDetail(targetUserId);
    const { data: connData, isLoading: connLoading, refetch: refetchConn } = useUserConnection(targetUserId, authUser?.id);
    const { data: images = [], isLoading: imagesLoading } = useProfileImages(targetUserId);
    const { data: initialSpied, isLoading: spiedLoading } = useSpiedStatus(targetUserId, authUser?.id);
    const { data: receivedMsg, isLoading: msgLoading } = useHasReceivedMessage(targetUserId, authUser?.id);

    // Derived states
    const connectionStatus = connData?.status || null;
    const incomingStatus = connData?.incomingStatus || null;
    const hasReceivedMessage = !!receivedMsg;
    const loading = userLoading || connLoading || imagesLoading || spiedLoading || msgLoading;

    // State for local UI
    const [isRevealed, setIsRevealed] = useState(false);
    const [isSpied, setIsSpied] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [requesting, setRequesting] = useState(false);
    const [showDisconnectModal, setShowDisconnectModal] = useState(false);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'UPGRADE' | 'OUT_OF_CREDITS'>('UPGRADE');

    useEffect(() => {
        if (initialSpied) {
            setIsSpied(true);
            setIsRevealed(true);
        }
    }, [initialSpied]);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const handleSendRequest = async () => {
        if (!id || !authUser || requesting) return;
        setRequesting(true);
        try {
            const { error } = await supabase
                .from('connections')
                .insert({
                    requester_id: authUser.id,
                    recipient_id: id,
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
        if (!id || !authUser || requesting) return;
        setRequesting(true);
        try {
            const { error } = await supabase
                .from('connections')
                .update({ status: 'CONNECTED' })
                .eq('requester_id', id)
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
        if (!id || !authUser || requesting) return;
        setRequesting(true);
        try {
            const { error } = await supabase
                .from('connections')
                .delete()
                .eq('requester_id', authUser.id)
                .eq('recipient_id', id);
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
        if (!id || !authUser || requesting) return;
        setRequesting(true);
        try {
            const { error } = await supabase
                .from('connections')
                .delete()
                .or(`and(requester_id.eq.${authUser.id},recipient_id.eq.${id}),and(requester_id.eq.${id},recipient_id.eq.${authUser.id})`);

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
        if (!user || !authUser) return;

        const currentRole = (stripeRole || '').toLowerCase();

        if (currentRole === 'max') {
            setIsRevealed(true);
            return;
        }

        if (currentRole === 'pro') {
            if (isSpied) {
                setIsRevealed(true);
                return;
            }

            const currentCredits = Number(myProfile?.spy_credits || 0);
            if (currentCredits > 0) {
                try {
                    const { error: spiedError } = await supabase
                        .from('spied_profiles')
                        .insert({
                            user_id: authUser.id,
                            target_user_id: user.id
                        });
                    if (spiedError) throw spiedError;

                    const { error: creditsError } = await supabase
                        .from('users')
                        .update({ spy_credits: currentCredits - 1 })
                        .eq('id', authUser.id);
                    if (creditsError) throw creditsError;

                    await refreshProfile();
                    setIsSpied(true);
                    setIsRevealed(true);
                    setNotification(`Reveal successful! ${currentCredits - 1} credits remaining.`);
                } catch (error) {
                    console.error("Error revealing profile", error);
                    setNotification("Failed to reveal. Please try again.");
                }
            } else {
                setModalMode('OUT_OF_CREDITS');
                setIsUpgradeModalOpen(true);
            }
        } else {
            setModalMode('UPGRADE');
            setIsUpgradeModalOpen(true);
        }
    };

    if (loading && !user) {
        return (
            <div className="min-h-screen w-full bg-background-dark flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-background-dark text-white flex flex-col items-center justify-center p-6">
                <Icon name="person_off" className="text-6xl text-white/20 mb-4" />
                <h2 className="text-xl font-bold mb-2">User Not Found</h2>
                <button
                    onClick={() => navigate(-1)}
                    className="mt-4 px-6 py-2 bg-primary rounded-full font-bold"
                >
                    Go Back
                </button>
            </div>
        );
    }

    const filteredImages = images.filter(img => img.visibility === activeTab);
    const avatarUrl = user.profile_picture_url || getDefaultAvatar(user.gender, targetUserId);
    const amIMax = (stripeRole || '').toLowerCase() === 'max';
    const amIPro = (stripeRole || '').toLowerCase() === 'pro';
    const isTheyMax = (user.stripe_role || '').toLowerCase() === 'max' || user.user_type === 'AI';
    const isOwner = authUser?.id === targetUserId;

    return (
        <div className="relative flex min-h-screen w-full flex-col overflow-hidden pb-24 text-white bg-background-dark">
            {/* Notification */}
            {notification && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-black/80 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
                    <p className="text-white text-sm font-medium">{notification}</p>
                </div>
            )}

            {/* Header */}
            <header className="sticky top-0 z-20 flex w-full items-center bg-background-dark/80 px-4 py-3 backdrop-blur-md">
                <div className="flex w-10 items-center justify-start">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white hover:bg-white/10 active:scale-95 transition-all"
                    >
                        <Icon name="arrow_back" />
                    </button>
                </div>

                <div className="flex-1 text-center truncate px-2">
                    <span className="text-white text-lg font-bold tracking-tight">
                        {((user.display_name || user.username || 'User').split(' ')[0])}'s{"\u00A0\u00A0"}Profile
                    </span>
                </div>

                <div className="flex w-10 items-center justify-end">
                    {connectionStatus === 'CONNECTED' ? (
                        <EllipsisMenu
                            items={[
                                {
                                    label: 'Disconnect',
                                    icon: 'person_remove',
                                    variant: 'danger',
                                    onClick: () => setShowDisconnectModal(true)
                                }
                            ]}
                        />
                    ) : (
                        <div className="w-10" />
                    )}
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center px-4 pt-4 gap-6 w-full max-w-md mx-auto">
                {/* Avatar Section */}
                <div className="flex w-full flex-col items-center gap-5">
                    <div className="relative">
                        <div className="h-32 w-32 rounded-full p-1 bg-gradient-to-tr from-primary to-purple-600 shadow-xl shadow-primary/20">
                            <CdnImage
                                path={user.profile_picture_url}
                                gender={user.gender}
                                seed={targetUserId}
                                className="h-full w-full rounded-full bg-cover bg-center border-4 border-background-dark"
                                useAsBackground
                            />
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            {user.display_name}
                        </h2>
                        <p className="text-white/60 text-sm font-medium flex items-center gap-1">
                            @{user.username}
                        </p>
                        {user.location && (
                            <p className="text-primary/80 text-[12px] font-bold flex items-center gap-1 mt-0.5">
                                <Icon name="location_on" className="text-[14px]" />
                                {user.location}
                            </p>
                        )}
                        {user.gender && user.gender !== 'PREFER_NOT_TO_SAY' && (
                            <div className="mt-1 flex items-center gap-1 px-3 py-0.5 rounded-full bg-white/5 border border-white/10">
                                <Icon name={user.gender === 'MALE' ? 'male' : user.gender === 'FEMALE' ? 'female' : 'person'} className="text-[14px] text-white/40" />
                                <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">{user.gender}</span>
                            </div>
                        )}
                        {connectionStatus === 'CONNECTED' && (
                            <div className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30">
                                <Icon name="check_circle" className="text-[14px] text-green-400" />
                                <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Connected</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bio */}
                {user.bio && (
                    <div className="w-full text-center px-2">
                        <p className="text-white/90 text-sm leading-relaxed">
                            {user.bio}
                        </p>
                    </div>
                )}

                {/* Tags (Interests) */}
                {user.interests && user.interests.length > 0 && (
                    <div className="flex w-full flex-wrap justify-center gap-2 px-2 mt-[-8px]">
                        {user.interests.map((interest: string) => (
                            <div
                                key={interest}
                                className="flex items-center justify-center rounded-full bg-white/5 backdrop-blur-md border border-white/10 px-3 py-1.5 transition-all hover:bg-white/10"
                            >
                                <p className="text-white/90 text-[10px] font-black uppercase tracking-[0.1em]">
                                    #{interest.replace(/\s+/g, '')}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                <div className="w-full h-px bg-white/5 my-2"></div>

                {/* Shared Media */}
                <div className="flex w-full flex-col gap-4 mb-4">
                    <div className="flex items-center justify-between w-full">
                        <h3 className="text-white text-base font-bold">Media Vault</h3>
                        <div className="flex bg-surface-dark rounded-full p-1 border border-white/5">
                            <button
                                onClick={() => setActiveTab('PUBLIC')}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${activeTab === 'PUBLIC' ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:text-white'}`}
                            >
                                Public
                            </button>
                            <button
                                onClick={() => setActiveTab('PRIVATE')}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${activeTab === 'PRIVATE' ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:text-white'}`}
                            >
                                Private
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 w-full">
                        {filteredImages.map((img, idx) => {
                            const isImgPrivate = img.visibility === 'PRIVATE';
                            const showImgSpyMode = isImgPrivate && !isRevealed && !isOwner;

                            return (
                                <div
                                    key={img.id || idx}
                                    className="aspect-[3/4] rounded-lg overflow-hidden bg-surface-dark relative group cursor-pointer"
                                    onClick={() => !showImgSpyMode && setPreviewImage(img.url)}
                                >
                                    {/* Normal image handling with CdnImage */}
                                    <CdnImage
                                        path={img.url}
                                        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-300 ${showImgSpyMode ? 'opacity-0' : 'opacity-100'}`}
                                        useAsBackground
                                    />

                                    {/* Blurred Placeholder for Private (Using blurred_url if exists) */}
                                    {showImgSpyMode && (
                                        <CdnImage
                                            path={img.blurred_url || img.url}
                                            gender={user.gender}
                                            seed={targetUserId}
                                            className="absolute inset-0 bg-cover bg-center blur-2xl scale-110"
                                            useAsBackground
                                        />
                                    )}

                                    {/* Spy Overlay */}
                                    {showImgSpyMode && (
                                        <div
                                            className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md z-10"
                                            onClick={handleRevealClick}
                                        >
                                            <Icon name="visibility" className="text-white text-2xl animate-pulse" />
                                        </div>
                                    )}

                                    {/* Private marker */}
                                    {isImgPrivate && !showImgSpyMode && (
                                        <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-md rounded-full p-1 border border-white/10">
                                            <Icon name="key" className="text-[10px] text-primary" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {filteredImages.length === 0 && (
                            <div className="col-span-3 py-10 text-center text-white/30 text-sm">
                                No {activeTab.toLowerCase()} photos shared yet.
                            </div>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-6 flex gap-4 z-30">
                    {authUser?.id === id ? (
                        <button
                            onClick={() => navigate('/profile/edit')}
                            className="flex-1 h-14 rounded-2xl bg-primary shadow-lg shadow-primary/30 flex items-center justify-center gap-2 font-bold active:scale-95 transition-all text-white"
                        >
                            <Icon name="edit" className="text-xl" />
                            Edit My Profile
                        </button>
                    ) : (
                        <>
                            <AnimatePresence mode="wait">
                                {connectionStatus !== 'CONNECTED' && (
                                    <>
                                        {incomingStatus === 'PENDING' ? (
                                            <motion.button
                                                key="accept"
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={handleAcceptRequest}
                                                disabled={requesting}
                                                className="flex-1 h-14 rounded-2xl bg-primary shadow-lg shadow-primary/30 flex items-center justify-center gap-2 font-bold active:scale-95 transition-all text-white"
                                            >
                                                <Icon name="person_add" className="text-xl" />
                                                {requesting ? 'Processing...' : 'Accept Request'}
                                            </motion.button>
                                        ) : connectionStatus === 'PENDING' ? (
                                            <motion.button
                                                key="pending"
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={handleCancelRequest}
                                                disabled={requesting}
                                                className="flex-1 h-14 rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10 flex items-center justify-center gap-2 font-bold text-white/50"
                                            >
                                                <Icon name="hourglass_empty" className="text-xl" />
                                                {requesting ? 'Cancelling...' : 'Request Sent'}
                                            </motion.button>
                                        ) : (
                                            <motion.button
                                                key="send"
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={handleSendRequest}
                                                disabled={requesting}
                                                className="flex-1 h-14 rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10 flex items-center justify-center gap-2 font-bold active:scale-95 transition-all"
                                            >
                                                <Icon name="person_add" className="text-xl" />
                                                {requesting ? 'Sending...' : 'Send Request'}
                                            </motion.button>
                                        )}
                                    </>
                                )}
                            </AnimatePresence>
                            {(amIMax || (amIPro && connectionStatus === 'CONNECTED') || (!amIMax && !amIPro && user?.user_type === 'HUMAN') || user?.user_type === 'AI' || hasReceivedMessage) && (
                                <button
                                    onClick={() => navigate(`/chat/${user.id}`, {
                                        state: {
                                            user: {
                                                name: user.display_name,
                                                avatar: avatarUrl,
                                                userType: user.user_type,
                                                isTheyMax: isTheyMax
                                            }
                                        }
                                    })}
                                    className={`h-14 rounded-2xl flex items-center justify-center gap-2 font-bold active:scale-95 transition-all ${connectionStatus === 'CONNECTED'
                                        ? 'w-full bg-primary shadow-lg shadow-primary/30 text-white'
                                        : 'flex-1 bg-white/5 backdrop-blur-lg border border-white/10'
                                        }`}
                                >
                                    <Icon name="chat_bubble" className="text-xl" />
                                    Message
                                </button>
                            )}

                        </>
                    )}
                </div>
            </main>

            {/* Disconnect Confirmation Modal */}
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
                                <p className="text-white/60 mb-8">Are you sure you want to remove {user.display_name || user.username} from your connections?</p>
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={handleDisconnect}
                                        disabled={requesting}
                                        className="w-full h-14 rounded-2xl bg-red-500 text-white font-bold shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                                    >
                                        {requesting ? 'Disconnecting...' : 'Yes, Disconnect'}
                                    </button>
                                    <button
                                        onClick={() => setShowDisconnectModal(false)}
                                        className="w-full h-14 rounded-2xl bg-white/5 text-white/50 font-bold hover:bg-white/10 active:scale-95 transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </motion.div>
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
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4"
                        onClick={() => setPreviewImage(null)}
                    >
                        <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ delay: 0.1 }}
                            onClick={() => setPreviewImage(null)}
                            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-[110]"
                        >
                            <Icon name="close" className="text-[24px]" />
                        </motion.button>
                        <CdnImage
                            path={previewImage}
                            gender={user.gender}
                            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl z-100"
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <UpgradeModal
                isOpen={isUpgradeModalOpen}
                onClose={() => setIsUpgradeModalOpen(false)}
                mode={modalMode}
            />
        </div>
    );
};

export default ProfilePreview;
