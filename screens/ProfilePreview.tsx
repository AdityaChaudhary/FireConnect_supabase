import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useLoaderData } from 'react-router';
import { useSafeNavigate } from '../hooks/useSafeNavigate';
import type { MetaFunction, LoaderFunctionArgs } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import EllipsisMenu from '../components/EllipsisMenu';
import UpgradeModal from '../components/UpgradeModal';
import { useUserDetail, useUserConnection, useProfileImages, useSpiedStatus, useHasReceivedMessage } from '../hooks/useData';
import { getDefaultAvatar } from '../lib/image-utils';
import CdnImage from '../components/CdnImage';
import { supabase as browserSupabase } from '../lib/supabase.client';
import { createSupabaseServerClient } from '../lib/supabase.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
    const { id: targetUserId } = params;
    const { supabase } = createSupabaseServerClient(request);
    
    // Get viewer user if any
    const { data: { user: authUser } } = await supabase.auth.getUser();

    const { data: rpcData, error } = await supabase.rpc('get_profile_preview_data', {
        p_viewer_id: authUser?.id || null,
        p_target_user_id: targetUserId
    });

    if (error) {
        console.error("RPC Error:", error);
        return { user: null, images: [], connection: null, isSpied: false, hasReceivedMessage: false };
    }

    const viewData = rpcData as unknown as import('../config/rpc').ProfilePreviewData;

    // connection is already specific to (viewer, target) pair from RPC
    // We just need to map it to the UI's expected status format
    const conn = viewData.connection;
    let formattedConn = null;

    if (conn) {
        if (conn.status === 'CONNECTED') {
            const isRequester = conn.requester_id === authUser?.id;
            formattedConn = {
                ...conn,
                status: 'CONNECTED',
                incomingStatus: isRequester ? null : 'CONNECTED',
                outgoingStatus: isRequester ? 'CONNECTED' : null
            };
        } else if (conn.status === 'PENDING') {
            if (conn.requester_id === targetUserId) {
                 formattedConn = { ...conn, status: conn.status, incomingStatus: conn.status, outgoingStatus: null };
            } else if (conn.requester_id === authUser?.id) {
                 formattedConn = { ...conn, status: conn.status, incomingStatus: null, outgoingStatus: conn.status };
            }
        }
    }

    return { 
        user: viewData.user,
        images: viewData.images || [],
        connection: formattedConn,
        isSpied: !!viewData.spied,
        hasReceivedMessage: viewData.has_received_message
    };
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    const user = data?.user;
    const displayName = user?.display_name || 'User';
    return [
        { title: `Chat with ${displayName} on FireConnect` },
        { name: "description", content: `Connect with ${displayName} on FireConnect. ${user?.bio || 'The most exclusive network for verified adults.'}` },
        { property: "og:title", content: `FireConnect - ${displayName}` },
        { property: "og:description", content: `Connect with ${displayName} on FireConnect.` },
    ];
};

const ProfilePreview: React.FC = () => {
    const initialData = useLoaderData<typeof loader>();
    const { id } = useParams<{ id: string }>();
    const { safeNavigate, safeBack } = useSafeNavigate();
    const queryClient = useQueryClient();
    const { user: authUser, profile: myProfile, refreshProfile } = useAuth();
    const stripeRole = myProfile?.stripe_role || 'FREE';

    // React Query Hooks
    const targetUserId = id || '';
    const { data: user, isLoading: userLoading } = useUserDetail(targetUserId, initialData.user);
    const { data: connData, isLoading: connLoading } = useUserConnection(targetUserId, authUser?.id, initialData.connection);
    const { data: images = [], isLoading: imagesLoading } = useProfileImages(targetUserId, initialData.images);
    const { data: initialSpied, isLoading: spiedLoading } = useSpiedStatus(targetUserId, authUser?.id, initialData.isSpied);
    const { data: receivedMsg, isLoading: msgLoading } = useHasReceivedMessage(targetUserId, authUser?.id, initialData.hasReceivedMessage);

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
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const [requesting, setRequesting] = useState(false);
    const [showDisconnectModal, setShowDisconnectModal] = useState(false);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'UPGRADE' | 'OUT_OF_CREDITS'>('UPGRADE');
    const [isSpying, setIsSpying] = useState(false);
    const [loadedAssets, setLoadedAssets] = useState<Record<string, boolean>>({});

    useEffect(() => {
        setLoadedAssets({});
    }, [targetUserId, images.length]);

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

    const handleNextImage = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (previewIndex !== null && previewIndex < images.length - 1) {
            setPreviewIndex(previewIndex + 1);
        }
    };

    const handlePrevImage = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (previewIndex !== null && previewIndex > 0) {
            setPreviewIndex(previewIndex - 1);
        }
    };

    const handleDragEnd = (_e: any, info: any) => {
        const swipeThreshold = 50;
        if (info.offset.x < -swipeThreshold) {
            handleNextImage();
        } else if (info.offset.x > swipeThreshold) {
            handlePrevImage();
        }
    };

    const handleSendRequest = async () => {
        if (!id || !authUser || requesting) return;
        setRequesting(true);
        try {
            const { error } = await browserSupabase
                .from('connections')
                .insert({
                    requester_id: authUser.id,
                    recipient_id: id,
                    status: 'PENDING'
                });
            if (error) throw error;
            
            // Invalidate queries to update connection status across the app
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['user-connection', targetUserId, authUser.id] }),
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
        if (!id || !authUser || requesting) return;
        setRequesting(true);
        try {
            const { error } = await browserSupabase
                .from('connections')
                .update({ 
                    status: 'CONNECTED',
                    updated_at: new Date().toISOString()
                })
                .eq('requester_id', id)
                .eq('recipient_id', authUser.id);
            if (error) throw error;

            // Invalidate queries to update connection status across the app
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['user-connection', targetUserId, authUser.id] }),
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
        if (!id || !authUser || requesting) return;
        setRequesting(true);
        try {
            const { error } = await browserSupabase
                .from('connections')
                .delete()
                .eq('requester_id', authUser.id)
                .eq('recipient_id', id);
            if (error) throw error;

            // Invalidate queries to update connection status across the app
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['user-connection', targetUserId, authUser.id] }),
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
        if (!id || !authUser || requesting) return;
        setRequesting(true);
        try {
            const { error } = await browserSupabase
                .from('connections')
                .delete()
                .or(`and(requester_id.eq.${authUser.id},recipient_id.eq.${id}),and(requester_id.eq.${id},recipient_id.eq.${authUser.id})`);
            
            if (error) throw error;

            // Invalidate queries to update connection status across the app
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['user-connection', targetUserId, authUser.id] }),
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

    const handleRevealClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user || !authUser) return;

        const currentRole = (stripeRole || '').toLowerCase();

        if (currentRole === 'max' || currentRole === 'pro') {
            if (isSpied) {
                setIsRevealed(true);
                return;
            }

            const isPro = currentRole === 'pro';
            const currentCredits = Number(myProfile?.spy_credits || 0);

            if (isPro && currentCredits <= 0) {
                setModalMode('OUT_OF_CREDITS');
                setIsUpgradeModalOpen(true);
                return;
            }

            setIsSpying(true);
            try {
                const { error: spiedError } = await browserSupabase
                    .from('spied_profiles')
                    .insert({
                        user_id: authUser.id,
                        target_user_id: user.id
                    });
                if (spiedError) throw spiedError;

                if (isPro) {
                    const { error: creditsError } = await browserSupabase
                        .from('users')
                        .update({ spy_credits: currentCredits - 1 })
                        .eq('id', authUser.id);
                    if (creditsError) throw creditsError;
                    await refreshProfile();
                }

                setIsSpied(true);

                // Update local cache for spied user IDs
                if (authUser?.id) {
                    const queryKey = ['spied-user-ids', authUser.id];
                    const previousIds = queryClient.getQueryData<string[]>(queryKey) || [];
                    if (!previousIds.includes(user.id)) {
                        queryClient.setQueryData<string[]>(queryKey, [...previousIds, user.id]);
                    }

                    // Also update spied-status for this specific user
                    queryClient.setQueryData(['spied-status', user.id, authUser.id], true);
                    
                    // Force refresh ONLY private images resolved URLs for this user
                    // We use resetQueries instead of invalidateQueries to CLEAR the cache immediately.
                    // This prevents 'useQuery' from returning the stale (unauthorized/expired) URL while fetching the new one.
                    // Returning the stale URL causes the browser to try fetching it (Request 1 - 403/fail), 
                    // before the new URL is ready (Request 2).
                    // By resetting, we force 'data' to undefined and 'isLoading' to true instantly.
                    const privateImages = images.filter(img => img.visibility === 'PRIVATE');
                    await Promise.all(privateImages.map(img => 
                        queryClient.resetQueries({ queryKey: ['resolved-image', img.url] })
                    ));
                }

                setIsRevealed(true);
                setNotification(isPro ? `Reveal successful! ${currentCredits - 1} credits remaining.` : `Unlocked with MAX benefits!`);
            } catch (error) {
                console.error("Error revealing profile", error);
                setNotification("Failed to reveal. Please try again.");
            } finally {
                setIsSpying(false);
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
                    onClick={() => safeBack()}
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
        <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden text-white bg-background-dark lg:h-screen lg:overflow-hidden">
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
                    onClick={() => safeBack()}
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

            <main className="flex-1 flex flex-col items-center lg:flex-row lg:items-start lg:h-[calc(100vh-64px)] w-full max-w-7xl mx-auto lg:overflow-hidden pb-40 lg:pb-0">
                {/* Left Column: Media Vault (Responsive) */}
                <div className="flex-1 w-full lg:h-full lg:overflow-y-auto lg:hide-scrollbar p-4 lg:p-8 order-2 lg:order-1">
                    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
                        {/* Shared Media Header (Desktop only inside column) */}
                        <div className="flex items-center justify-between w-full">
                            <h3 className="text-white text-xl font-black tracking-tight flex items-center gap-3">
                                <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <Icon name="photo_library" className="text-primary text-xl" />
                                </div>
                                Media Vault
                            </h3>
                            <div className="flex bg-surface-dark rounded-full p-1 border border-white/5 shadow-inner">
                                <button
                                    onClick={() => setActiveTab('PUBLIC')}
                                    className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'PUBLIC' ? 'bg-primary text-white shadow-[0_0_15px_rgba(236,19,146,0.4)]' : 'text-white/40 hover:text-white/60'}`}
                                >
                                    Public
                                </button>
                                <button
                                    onClick={() => setActiveTab('PRIVATE')}
                                    className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'PRIVATE' ? 'bg-primary text-white shadow-[0_0_15px_rgba(236,19,146,0.4)]' : 'text-white/40 hover:text-white/60'}`}
                                >
                                    Private
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full">
                            {filteredImages.map((img, idx) => {
                                const isImgPrivate = img.visibility === 'PRIVATE';
                                const showImgSpyMode = isImgPrivate && !isRevealed && !isOwner;

                                return (
                                    <div
                                        key={img.id || idx}
                                        className="aspect-[3/4] rounded-2xl overflow-hidden bg-surface-dark relative group cursor-pointer border border-white/5 hover:border-primary/30 transition-all hover:scale-[1.02] active:scale-95 shadow-lg"
                                        onClick={() => {
                                            const globalIndex = images.findIndex(i => i.id === img.id);
                                            if (!showImgSpyMode) setPreviewIndex(globalIndex);
                                        }}
                                    >
                                        <CdnImage
                                            path={img.url}
                                            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-300 ${showImgSpyMode ? 'opacity-0' : 'opacity-100'}`}
                                            useAsBackground
                                            showSpinner={true}
                                            onLoad={() => setLoadedAssets(prev => ({ ...prev, [img.id || idx]: true }))}
                                        />

                                        {showImgSpyMode && (
                                            <CdnImage
                                                path={img.blurred_url || img.url}
                                                gender={user.gender}
                                                seed={targetUserId}
                                                className="absolute inset-0 bg-cover bg-center blur-sm scale-110"
                                                useAsBackground
                                                showSpinner={true}
                                            />
                                        )}

                                        {showImgSpyMode && (
                                            <div
                                                className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-[blur:2px] z-10 group-hover:bg-black/30 transition-colors"
                                                onClick={handleRevealClick}
                                            >
                                                <div className="size-12 rounded-full bg-white/10 flex items-center justify-center border border-white/20 shadow-xl group-hover:scale-110 transition-transform">
                                                    <Icon name="visibility" className="text-white text-2xl animate-pulse" />
                                                </div>
                                            </div>
                                        )}

                                        {isImgPrivate && !showImgSpyMode && (
                                            <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md rounded-full p-1.5 border border-white/10 shadow-lg">
                                                <Icon name="key" className="text-[12px] text-primary" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {filteredImages.length === 0 && (
                                <div className="col-span-full py-20 flex flex-col items-center justify-center text-white/20 gap-4 bg-white/5 rounded-3xl border border-dashed border-white/10">
                                    <Icon name="no_photography" className="text-4xl" />
                                    <p className="text-sm font-bold uppercase tracking-widest">No {activeTab.toLowerCase()} photos</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: User Info & Actions (Sticky on Desktop) */}
                <div className="w-full lg:w-[450px] lg:h-full lg:overflow-y-auto lg:hide-scrollbar lg:border-l lg:border-white/5 bg-background-dark/50 backdrop-blur-sm p-6 lg:p-10 flex flex-col gap-8 pb-10 order-1 lg:order-2">
                    <div className="flex flex-col items-center lg:items-start gap-6">
                        {/* Avatar */}
                        <div className="relative group">
                            <div className="h-32 w-32 lg:h-40 lg:w-40 rounded-full p-1 bg-gradient-to-tr from-primary to-purple-600 shadow-2xl shadow-primary/20 group-hover:scale-105 transition-transform duration-500">
                                <CdnImage
                                    path={user.profile_picture_url}
                                    gender={user.gender}
                                    seed={targetUserId}
                                    className="h-full w-full rounded-full bg-cover bg-center border-4 border-[#1a0b12]"
                                    useAsBackground
                                    showSpinner={true}
                                />
                            </div>
                        </div>

                        {/* Info */}
                        <div className="flex flex-col items-center lg:items-start gap-2">
                            <div className="flex flex-col items-center lg:items-start gap-1">
                                <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tight flex items-center gap-3">
                                    {user.display_name}
                                    {isTheyMax && (
                                        <div className="bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-[0_0_15px_rgba(168,85,247,0.2)]">MAX</div>
                                    )}
                                </h2>
                                <p className="text-white/40 text-sm font-bold tracking-wide">@{user.username}</p>
                            </div>
                            
                            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mt-2">
                                {user.location && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/5 border border-primary/20 text-primary text-[11px] font-black uppercase tracking-wider">
                                        <Icon name="location_on" className="text-sm" />
                                        {user.location}
                                    </div>
                                )}
                                {user.gender && user.gender !== 'PREFER_NOT_TO_SAY' && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 text-[11px] font-black uppercase tracking-wider">
                                        <Icon name={user.gender === 'MALE' ? 'male' : user.gender === 'FEMALE' ? 'female' : 'person'} className="text-sm" />
                                        {user.gender}
                                    </div>
                                )}
                                {connectionStatus === 'CONNECTED' && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-[11px] font-black uppercase tracking-wider shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                                        <Icon name="check_circle" className="text-sm" filled />
                                        Connected
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bio */}
                        {user.bio && (
                            <div className="w-full">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-3 ml-1">About</h4>
                                <div className="bg-white/5 rounded-3xl p-5 border border-white/5 shadow-inner">
                                    <p className="text-white/80 text-[15px] leading-relaxed font-medium italic">
                                        "{user.bio}"
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Interests */}
                        {user.interests && user.interests.length > 0 && (
                            <div className="w-full">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-3 ml-1">Interests</h4>
                                <div className="flex flex-wrap gap-2">
                                    {user.interests.map((interest: string) => (
                                        <div
                                            key={interest}
                                            className="px-4 py-2 rounded-2xl bg-surface-dark border border-white/10 hover:border-primary/40 hover:bg-white/5 transition-all group/tag cursor-default"
                                        >
                                            <p className="text-white/70 group-hover/tag:text-white text-[11px] font-black uppercase tracking-widest transition-colors">
                                                #{interest.replace(/\s+/g, '')}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Actions (Desktop only) */}
                        <div className="hidden lg:flex w-full mt-6">
                            <div className="w-full flex flex-col gap-3">
                                {isOwner ? (
                                    <button
                                        onClick={() => safeNavigate('/profile/edit')}
                                        className="h-16 w-full rounded-2xl bg-primary shadow-xl shadow-primary/30 flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all text-white btn-glow"
                                    >
                                        <Icon name="edit" className="text-xl" />
                                        Edit Profile
                                    </button>
                                ) : (
                                    <div className="flex gap-3">
                                        <AnimatePresence mode="wait">
                                            {connectionStatus !== 'CONNECTED' && (
                                                <div className="flex-1 flex flex-col gap-3">
                                                    {incomingStatus === 'PENDING' ? (
                                                        <motion.button
                                                            key="accept"
                                                            initial={{ opacity: 0, scale: 0.9 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            exit={{ opacity: 0, scale: 0.9 }}
                                                            onClick={handleAcceptRequest}
                                                            disabled={requesting}
                                                            className="h-16 w-full rounded-2xl bg-primary shadow-xl shadow-primary/30 flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all text-white btn-glow disabled:opacity-50"
                                                        >
                                                            {requesting ? (
                                                                <div className="size-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                                            ) : (
                                                                <>
                                                                    <Icon name="person_add" className="text-xl" />
                                                                    Accept Request
                                                                </>
                                                            )}
                                                        </motion.button>
                                                    ) : connectionStatus === 'PENDING' ? (
                                                        <motion.button
                                                            key="pending"
                                                            initial={{ opacity: 0, scale: 0.9 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            exit={{ opacity: 0, scale: 0.9 }}
                                                            onClick={handleCancelRequest}
                                                            disabled={requesting}
                                                            className="h-16 w-full rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest text-white/40 active:scale-95 transition-all disabled:opacity-50"
                                                        >
                                                            {requesting ? (
                                                                <div className="size-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin"></div>
                                                            ) : (
                                                                <>
                                                                    <Icon name="hourglass_empty" className="text-xl animate-pulse" />
                                                                    Request Sent
                                                                </>
                                                            )}
                                                        </motion.button>
                                                    ) : (
                                                        <motion.button
                                                            key="send"
                                                            initial={{ opacity: 0, scale: 0.9 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            exit={{ opacity: 0, scale: 0.9 }}
                                                            onClick={handleSendRequest}
                                                            disabled={requesting}
                                                            className="h-16 w-full rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 hover:border-primary/40 hover:bg-primary/10 flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest text-white hover:text-primary transition-all active:scale-95 group disabled:opacity-50"
                                                        >
                                                            {requesting ? (
                                                                <div className="size-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                                            ) : (
                                                                <>
                                                                    <Icon name="person_add" className="text-xl group-hover:scale-110 transition-transform" />
                                                                    Send Request
                                                                </>
                                                            )}
                                                        </motion.button>
                                                    )}
                                                </div>
                                            )}
                                        </AnimatePresence>

                                        {(amIMax || (amIPro && connectionStatus === 'CONNECTED') || (!amIMax && !amIPro && user?.user_type === 'HUMAN') || user?.user_type === 'AI' || hasReceivedMessage) && (
                                            <button
                                                onClick={() => safeNavigate(`/chat/${user.id}`, {
                                                    state: {
                                                        user: {
                                                            name: user.display_name,
                                                            avatar: avatarUrl,
                                                            userType: user.user_type,
                                                            isTheyMax: isTheyMax
                                                        }
                                                    }
                                                })}
                                                className={`h-16 rounded-2xl flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 ${connectionStatus === 'CONNECTED'
                                                    ? 'w-full bg-primary shadow-xl shadow-primary/30 text-white btn-glow'
                                                    : 'flex-1 bg-white/5 backdrop-blur-xl border border-white/10 text-white'
                                                    }`}
                                            >
                                                <Icon name="chat_bubble" className="text-xl" filled />
                                                Message
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions (Mobile only, fixed at bottom) */}
                <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[50] px-6 pb-8 pt-12 bg-gradient-to-t from-background-dark via-background-dark/95 to-transparent backdrop-blur-[2px]">
                    <div className="max-w-md mx-auto">
                    {isOwner ? (
                        <button
                            onClick={() => safeNavigate('/profile/edit')}
                            className="h-16 w-full rounded-2xl bg-primary shadow-xl shadow-primary/30 flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all text-white btn-glow"
                        >
                            <Icon name="edit" className="text-xl" />
                            Edit Profile
                        </button>
                    ) : (
                        <div className="flex gap-3">
                            <AnimatePresence mode="wait">
                                {connectionStatus !== 'CONNECTED' && (
                                    <div className="flex-1 flex flex-col gap-3">
                                        {incomingStatus === 'PENDING' ? (
                                            <motion.button
                                                key="accept"
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                onClick={handleAcceptRequest}
                                                disabled={requesting}
                                                className="h-16 w-full rounded-2xl bg-primary shadow-xl shadow-primary/30 flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all text-white btn-glow disabled:opacity-50"
                                            >
                                                {requesting ? (
                                                    <div className="size-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                                ) : (
                                                    <>
                                                        <Icon name="person_add" className="text-xl" />
                                                        Accept Request
                                                    </>
                                                )}
                                            </motion.button>
                                        ) : connectionStatus === 'PENDING' ? (
                                            <motion.button
                                                key="pending"
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                onClick={handleCancelRequest}
                                                disabled={requesting}
                                                className="h-16 w-full rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest text-white/40 active:scale-95 transition-all disabled:opacity-50"
                                            >
                                                {requesting ? (
                                                    <div className="size-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin"></div>
                                                ) : (
                                                    <>
                                                        <Icon name="hourglass_empty" className="text-xl animate-pulse" />
                                                        Request Sent
                                                    </>
                                                )}
                                            </motion.button>
                                        ) : (
                                            <motion.button
                                                key="send"
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                onClick={handleSendRequest}
                                                disabled={requesting}
                                                className="h-16 w-full rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 hover:border-primary/40 hover:bg-primary/10 flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest text-white hover:text-primary transition-all active:scale-95 group disabled:opacity-50"
                                            >
                                                {requesting ? (
                                                    <div className="size-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                                ) : (
                                                    <>
                                                        <Icon name="person_add" className="text-xl group-hover:scale-110 transition-transform" />
                                                        Send Request
                                                    </>
                                                )}
                                            </motion.button>
                                        )}
                                    </div>
                                )}
                            </AnimatePresence>

                            {(amIMax || (amIPro && connectionStatus === 'CONNECTED') || (!amIMax && !amIPro && user?.user_type === 'HUMAN') || user?.user_type === 'AI' || hasReceivedMessage) && (
                                <button
                                    onClick={() => safeNavigate(`/chat/${user.id}`, {
                                        state: {
                                            user: {
                                                name: user.display_name,
                                                avatar: avatarUrl,
                                                userType: user.user_type,
                                                isTheyMax: isTheyMax
                                            }
                                        }
                                    })}
                                    className={`h-16 rounded-2xl flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 ${connectionStatus === 'CONNECTED'
                                        ? 'w-full bg-primary shadow-xl shadow-primary/30 text-white btn-glow'
                                        : 'flex-1 bg-white/5 backdrop-blur-xl border border-white/10 text-white'
                                        }`}
                                >
                                    <Icon name="chat_bubble" className="text-xl" filled />
                                    Message
                                </button>
                            )}
                        </div>
                    )}
                    </div>
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
                                        className="w-full h-14 rounded-2xl bg-red-500 text-white font-bold shadow-lg shadow-red-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {requesting ? (
                                            <div className="size-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                        ) : 'Yes, Disconnect'}
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

            {/* Full Screen Image Navigator Modal */}
            <AnimatePresence>
                {previewIndex !== null && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 backdrop-blur-2xl"
                        onClick={() => setPreviewIndex(null)}
                    >
                        {/* Close Button */}
                        <motion.button
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => setPreviewIndex(null)}
                            className="absolute top-6 right-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all z-[140] backdrop-blur-md border border-white/10"
                        >
                            <Icon name="close" className="text-[24px]" />
                        </motion.button>

                        {/* Navigation Arrows */}
                        <div className="absolute inset-y-0 left-0 w-16 md:w-24 flex items-center justify-center z-[130]">
                            {previewIndex > 0 && (
                                <button
                                    onClick={handlePrevImage}
                                    className="p-3 md:p-4 rounded-full bg-white/5 text-white hover:bg-white/10 transition-all border border-white/10 backdrop-blur-sm"
                                >
                                    <Icon name="chevron_left" className="text-2xl md:text-3xl" />
                                </button>
                            )}
                        </div>
                        <div className="absolute inset-y-0 right-0 w-16 md:w-24 flex items-center justify-center z-[130]">
                            {previewIndex < images.length - 1 && (
                                <button
                                    onClick={handleNextImage}
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
                            onDragEnd={handleDragEnd}
                            className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={previewIndex}
                                    initial={{ opacity: 0, x: 100 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -100 }}
                                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                    className="relative w-full h-full flex items-center justify-center p-4"
                                >
                                    {(() => {
                                        const img = images[previewIndex];
                                        const isImgPrivate = img.visibility === 'PRIVATE';
                                        const showImgSpyMode = isImgPrivate && !isRevealed && !isOwner;

                                        return (
                                            <div className="relative w-full h-full flex items-center justify-center">
                                                {/* Main Image */}
                                                {!showImgSpyMode && (
                                                    <CdnImage
                                                        path={img.url}
                                                        gender={user.gender}
                                                        seed={targetUserId}
                                                        className="max-h-full max-w-full object-contain rounded-xl shadow-2xl transition-opacity duration-300 opacity-100"
                                                        showSpinner={true}
                                                        onLoad={() => setLoadedAssets(prev => ({ ...prev, [img.id || previewIndex]: true }))}
                                                    />
                                                )}

                                                {/* Spinner Overlay for navigator */}
                                                {!showImgSpyMode && !loadedAssets[img.id || previewIndex] && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-50">
                                                        <div className="size-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                                                    </div>
                                                )}

                                                {/* Blurred Placeholder & Spy Overlay */}
                                                {showImgSpyMode && (
                                                    <>
                                                        <CdnImage
                                                            path={img.blurred_url}
                                                            gender={user.gender}
                                                            seed={targetUserId}
                                                            className="max-h-full max-w-full object-contain blur-sm opacity-100"
                                                            showSpinner={true}
                                                        />
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
                                                            <div
                                                                className="z-10 flex flex-col items-center gap-4 p-8 rounded-3xl bg-black/40 backdrop-[blur:2px] border border-white/10"
                                                                onClick={handleRevealClick}
                                                            >
                                                                    <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 animate-pulse relative">
                                                                        {isSpying ? (
                                                                            <div className="size-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                                                                        ) : (
                                                                            <Icon name="visibility_off" className="text-4xl text-primary" />
                                                                        )}
                                                                    </div>
                                                                <div className="text-center">
                                                                    <h4 className="text-xl font-bold text-white mb-1">{isSpying ? 'Unlocking...' : 'Private Photo'}</h4>
                                                                    <p className="text-white/60 text-sm">{isSpying ? 'Please wait' : 'Tap to reveal this media'}</p>
                                                                </div>
                                                                {stripeRole === 'PRO' && !isSpying && (
                                                                    <div className="mt-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 flex items-center gap-2">
                                                                        <Icon name="stars" className="text-primary text-sm" />
                                                                        <span className="text-xs font-bold text-primary">{myProfile?.spy_credits || 0} Credits Left</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </>
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
                                    className={`h-1.5 rounded-full transition-all duration-300 ${idx === previewIndex ? 'w-8 bg-primary shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'w-1.5 bg-white/20'}`}
                                />
                            ))}
                        </div>
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
