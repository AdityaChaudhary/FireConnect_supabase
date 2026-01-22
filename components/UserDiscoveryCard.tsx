import React, { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeNavigate } from '../hooks/useSafeNavigate';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from './Icon';
import { supabase } from '../lib/supabase.client';
import { useAuth } from '../context/AuthContext';
import { resolveImageUrl } from '../lib/image-resolver';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver';

interface UserDiscoveryCardProps {
    user: any;
    isSpiedInitially?: boolean;
    onUpgradeClick?: (mode: 'UPGRADE' | 'OUT_OF_CREDITS') => void;
}

const UserDiscoveryCard: React.FC<UserDiscoveryCardProps> = ({ user, isSpiedInitially, onUpgradeClick }) => {
    const { safeNavigate } = useSafeNavigate();
    const queryClient = useQueryClient();
    const { stripeRole, profile, refreshProfile, user: authUser } = useAuth();
    const [images, setImages] = useState<any[]>(user.profile_images || []);
    const [loading, setLoading] = useState(!(user.profile_images && user.profile_images.length > 0));
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [viewableUrls, setViewableUrls] = useState<Record<number, string>>({});
    const [blurredViewableUrls, setBlurredViewableUrls] = useState<Record<number, string>>({});
    const normalizedRole = (stripeRole || 'free').toUpperCase();
    const [isRevealed, setIsRevealed] = useState(isSpiedInitially && normalizedRole !== 'FREE');
    const [isSpied, setIsSpied] = useState(isSpiedInitially || false);
    const [notification, setNotification] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [isSpying, setIsSpying] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isDraggingRef = useRef(false);

    const { targetRef, hasBeenInView } = useIntersectionObserver({
        rootMargin: '1200px', // Fetch images for the next 2-3 profiles in advance
    });



    useEffect(() => {
        const intervalId = setInterval(() => {
            setCurrentTime(Date.now());
        }, 10000); // Update every 10 seconds
        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        if (user.profile_images && user.profile_images.length > 0) {
            setImages(user.profile_images);
            setLoading(false);
        } else if (user.profile_picture_url) {
            setImages([{
                id: 'profile',
                url: user.profile_picture_url,
                visibility: 'PUBLIC',
                is_profile: true,
                blurred_url: null
            }]);
            setLoading(false);
        }
    }, [user.profile_images, user.profile_picture_url]);

    useEffect(() => {
        setIsSpied(isSpiedInitially || false);
    }, [isSpiedInitially]);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    useEffect(() => {
        if (!hasBeenInView || images.length === 0) return;

        const resolveUrls = async () => {
            const vUrls: Record<number, string> = { ...viewableUrls };
            const bUrls: Record<number, string> = { ...blurredViewableUrls };

            const promises = images.map(async (img, idx) => {
                const isPrivate = img.visibility === 'PRIVATE' || img.url.includes('/PRIVATE/') || img.url.includes('private-media/');
                const canFetchPrivate = normalizedRole === 'MAX' || (normalizedRole === 'PRO' && isSpied);

                if (img.blurred_url && !bUrls[idx]) {
                    bUrls[idx] = resolveImageUrl(img.blurred_url);
                }

                if ((!isPrivate || canFetchPrivate) && !vUrls[idx]) {
                    if (isPrivate) {
                        const cleanPath = img.url
                            .replace(/^(private-media)\//, '')
                            .replace(/^\//, '');
                        try {
                            const { data } = await supabase.storage
                                .from('private-media')
                                .createSignedUrl(cleanPath, 3600);
                            if (data) vUrls[idx] = data.signedUrl;
                        } catch (e) {
                            console.error("Error signing private URL", e);
                        }
                    } else {
                        vUrls[idx] = resolveImageUrl(img.url);
                    }
                }
            });

            await Promise.all(promises);

            setViewableUrls(vUrls);
            setBlurredViewableUrls(bUrls);
        };

        resolveUrls();
    }, [images, stripeRole, isSpied, user.id, hasBeenInView]);

    const handleNextImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentImageIndex < images.length - 1) {
            setCurrentImageIndex(prev => prev + 1);
        }
    };

    const handlePrevImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentImageIndex > 0) {
            setCurrentImageIndex(prev => prev - 1);
        }
    };

    const handleSpyClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const currentRole = (stripeRole || 'FREE').toUpperCase();

        if (currentRole === 'MAX' || currentRole === 'PRO') {
            if (isSpied) {
                setIsRevealed(true);
                const privateIdx = images.findIndex(img => img.visibility === 'PRIVATE');
                if (privateIdx !== -1) setCurrentImageIndex(privateIdx);
                return;
            }

            const isPro = currentRole === 'PRO';
            const currentCredits = Number(profile?.spy_credits || 0);

            if (isPro && currentCredits <= 0) {
                onUpgradeClick?.('OUT_OF_CREDITS');
                return;
            }

            setIsSpying(true);
            try {
                const { error: spyError } = await supabase
                    .from('spied_profiles')
                    .insert({ target_user_id: user.id, user_id: authUser?.id });

                if (spyError) throw spyError;

                if (isPro) {
                    const { error: creditError } = await supabase
                        .from('users')
                        .update({ spy_credits: currentCredits - 1 })
                        .eq('id', authUser?.id);

                    if (creditError) throw creditError;
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
                }

                setIsRevealed(true);
                setNotification(isPro ? `Spying: Private photos unlocked!` : `Unlocked with MAX benefits!`);

                const privateIdx = images.findIndex(img => img.visibility === 'PRIVATE');
                if (privateIdx !== -1) {
                    setTimeout(() => setCurrentImageIndex(privateIdx), 100);
                }
            } catch (error) {
                console.error("Error revealing profile", error);
                setNotification("Failed to spy. Please try again.");
            } finally {
                setIsSpying(false);
            }
        } else {
            onUpgradeClick?.('UPGRADE');
        }
    };

    const handleDragStart = () => {
        isDraggingRef.current = true;
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const handleDragEnd = (_: any, info: any) => {
        isDraggingRef.current = false;
        const swipeThreshold = 50;
        if (info.offset.x < -swipeThreshold && currentImageIndex < images.length - 1) {
            setCurrentImageIndex(prev => prev + 1);
        } else if (info.offset.x > swipeThreshold && currentImageIndex > 0) {
            setCurrentImageIndex(prev => prev - 1);
        }
    };

    const handlePointerDown = (_: React.PointerEvent) => {
        if (isDraggingRef.current) return;
        
        // Prevent default long press behavior on mobile
        longPressTimerRef.current = setTimeout(() => {
            setIsFullscreen(true);
            if (window.navigator.vibrate) {
                window.navigator.vibrate(50); // Haptic feedback
            }
        }, 500); // 500ms for long press
    };

    const handlePointerUp = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        setIsFullscreen(false);
    };

    const handlePointerCancel = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        setIsFullscreen(false);
    };

    const getOnlineStatus = () => {
        const statusObj = Array.isArray(user.user_online_status) ? user.user_online_status[0] : user.user_online_status;
        const lastSeen = statusObj?.last_seen_at;
        if (!lastSeen) return null;

        const seenDate = new Date(lastSeen).getTime();
        const diffInSeconds = Math.floor((currentTime - seenDate) / 1000);
        const diffInMinutes = Math.floor(diffInSeconds / 60);

        if (diffInSeconds < 300) { // 5 minute threshold
            return { label: 'Online', color: 'bg-green-500' };
        } else if (diffInMinutes < 24 * 60) {
            const hrs = Math.floor(diffInMinutes / 60);
            return { label: `Seen ${hrs === 0 ? 'recently' : `${hrs}h ago`}`, color: 'bg-white/20' };
        }
        return null;
    };

    const onlineStatus = getOnlineStatus();

    return (
        <motion.article
            ref={targetRef}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={handlePointerUp}
            className="flex flex-col bg-surface-dark rounded-[32px] overflow-hidden shadow-2xl relative aspect-[3/4.2] cursor-grab active:cursor-grabbing select-none"
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* Loading State / Empty Card Placeholder */}
            <AnimatePresence>
                {loading && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className="absolute inset-0 z-50 bg-[#1a0b14] flex items-center justify-center"
                    >
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative">
                                <Icon name="image" className="text-white/10 text-[64px]" />
                                <div className="absolute inset-0 border-2 border-primary/20 rounded-xl animate-ping"></div>
                            </div>
                            {!hasBeenInView && (
                                <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
                                    Waiting to load...
                                </p>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Image Swipe Area */}
            <div className="absolute inset-0 z-10 group/card">
                <div
                    className="flex h-full transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
                >
                    {images.length === 0 ? (
                        <div className="relative flex-shrink-0 w-full h-full bg-black/40 flex items-center justify-center">
                            <div className="text-center p-6">
                                <Icon name="image" className="text-white/20 text-4xl mb-4" />
                                <p className="text-white font-bold text-sm">No media</p>
                                <p className="text-white/40 text-xs">User has no uploaded pics</p>
                            </div>
                        </div>
                    ) : images.map((img, idx) => {
                        const isImgPrivate = img.visibility === 'PRIVATE';
                        const isImgRevealed = isRevealed && isSpied;
                        const showImgSpyMode = isImgPrivate && !isImgRevealed;
                        const viewUrl = viewableUrls[idx];
                        const blurUrl = blurredViewableUrls[idx];

                        return (
                            <div key={img.id || idx} className="relative flex-shrink-0 w-full h-full">
                                {blurUrl && (showImgSpyMode || !viewUrl) && (
                                    <div
                                        className="absolute inset-0 bg-cover bg-center blur-2xl scale-110"
                                        style={{ backgroundImage: `url("${blurUrl}")` }}
                                    ></div>
                                )}
                                {viewUrl && (
                                    <div
                                        className={`absolute inset-0 bg-cover bg-center transition-all duration-700 ${showImgSpyMode ? 'opacity-0' : 'opacity-100'}`}
                                        style={{ backgroundImage: `url("${viewUrl}")` }}
                                    ></div>
                                )}
                                {showImgSpyMode && (
                                    <div
                                        className="absolute inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center cursor-pointer z-40"
                                        onClick={handleSpyClick}
                                        onPointerDown={(e) => e.stopPropagation()}
                                    >
                                        <div className="text-center p-6">
                                            <div className="size-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4 border border-white/20 transition-transform active:scale-90 relative">
                                                {isSpying ? (
                                                    <div className="size-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                                                ) : (
                                                    <>
                                                        <Icon name="visibility_off" className="text-white/60 text-3xl" />
                                                        {normalizedRole === 'PRO' && (
                                                            <div className="absolute -top-1 -right-1 size-6 bg-primary rounded-full flex items-center justify-center border border-white/20 shadow-lg">
                                                                <span className="text-[11px] font-black text-white leading-none">{profile?.spy_credits || 0}</span>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                            <p className="text-white font-bold">{isSpying ? 'Unlocking...' : 'Private Media'}</p>
                                            <p className="text-white/50 text-xs">{isSpying ? 'Please wait' : 'Touch to Spy'}</p>
                                        </div>
                                    </div>
                                )}
                                {((loading || isSpying) || (isSpied && !viewUrl && isImgPrivate)) && currentImageIndex === idx && (
                                    <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/20 backdrop-blur-sm">
                                        <div className="flex flex-col items-center gap-4 -mt-24">
                                            <div className="size-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                                            {(isSpying || (isSpied && isImgPrivate)) && (
                                                <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
                                                    Unlocking...
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Left/Right Click Nav & Desktop Arrows */}
                <div
                    className="absolute inset-y-0 left-0 w-1/4 z-30 flex items-center justify-start pl-4 cursor-pointer"
                    onClick={handlePrevImage}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <div className="flex size-10 rounded-full bg-black/20 backdrop-blur-md border border-white/10 items-center justify-center text-white opacity-0 group-hover/card:opacity-100 transition-opacity">
                        <Icon name="chevron_left" />
                    </div>
                </div>
                <div
                    className="absolute inset-y-0 right-0 w-1/4 z-30 flex items-center justify-end pr-4 cursor-pointer"
                    onClick={handleNextImage}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <div className="flex size-10 rounded-full bg-black/20 backdrop-blur-md border border-white/10 items-center justify-center text-white opacity-0 group-hover/card:opacity-100 transition-opacity">
                        <Icon name="chevron_right" />
                    </div>
                </div>

            </div>

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-black/50 pointer-events-none z-[1]"></div>

            {/* Top Bar: Online Status */}
            <div className="absolute top-0 left-0 right-0 p-5 z-20 flex justify-between items-start">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        {onlineStatus && (
                            <motion.div
                                layout
                                className={`flex items-center justify-center h-6 rounded-full backdrop-blur-md border border-white/10 overflow-hidden ${onlineStatus.color} transition-colors duration-500`}
                                style={{
                                    paddingLeft: '11px',
                                    paddingRight: currentImageIndex === 0 ? '14px' : '11px',
                                    minWidth: currentImageIndex === 0 ? 'auto' : '24px'
                                }}
                            >
                                <div className={`size-1.5 rounded-full bg-white shrink-0 ${onlineStatus.label === 'Online' ? 'animate-pulse' : ''}`}></div>
                                <AnimatePresence mode="wait">
                                    {currentImageIndex === 0 && (
                                        <motion.span
                                            key="label"
                                            initial={{ opacity: 0, width: 0 }}
                                            animate={{ opacity: 1, width: 'auto' }}
                                            exit={{ opacity: 0, width: 0 }}
                                            transition={{ duration: 0.3, ease: "easeOut" }}
                                            className="text-[10px] font-black uppercase tracking-widest text-white leading-none whitespace-nowrap overflow-hidden ml-2"
                                        >
                                            {onlineStatus.label}
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}

                        {images[currentImageIndex]?.visibility === 'PRIVATE' && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex items-center justify-center h-6 w-6 rounded-full backdrop-blur-md border border-white/10 bg-black/20"
                            >
                                <Icon
                                    name={(!(isRevealed && isSpied)) ? 'lock' : 'key'}
                                    className="text-[12px] text-primary"
                                />
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Vertical Pagination Dots */}
                {images.length > 0 && (
                    <div className="flex flex-col gap-2.5 items-center bg-black/5 backdrop-blur-sm p-1.5 rounded-full border border-white/5">
                        {images.map((img, idx) => (
                            <div
                                key={idx}
                                className={`size-1.5 rounded-full transition-all duration-300 ${idx === currentImageIndex
                                    ? 'bg-white scale-125 shadow-[0_0_10px_rgba(255,255,255,0.8)]'
                                    : img.visibility === 'PRIVATE' ? 'bg-primary/20' : 'bg-white/10'
                                    }`}
                            ></div>
                        ))}
                    </div>
                )}
            </div>

            {/* Notification */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: -20, x: '-50%' }}
                        className="absolute top-20 left-1/2 z-30 bg-white/10 backdrop-blur-xl border border-white/20 px-5 py-2.5 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center gap-2.5"
                    >
                        <div className="size-5 rounded-full bg-primary/20 flex items-center justify-center">
                            <Icon name="visibility" className="text-primary text-sm" filled />
                        </div>
                        <p className="text-white text-xs font-bold tracking-wide uppercase">{notification}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Content Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 z-10 flex flex-col gap-4">
                {/* User Info */}
                <div className="flex flex-col gap-1">
                    <motion.div
                        animate={{ y: currentImageIndex === 0 ? 0 : 20 }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        className="flex items-baseline gap-2"
                    >
                        <h2 className="text-white text-3xl font-extrabold tracking-tight">
                            {user.display_name || user.username}
                        </h2>
                    </motion.div>

                    <motion.div
                        animate={{
                            opacity: currentImageIndex === 0 ? 1 : 0,
                            height: currentImageIndex === 0 ? 'auto' : 0,
                            marginBottom: currentImageIndex === 0 ? 0 : -4
                        }}
                        className="flex items-center gap-2 text-white/70 text-sm font-medium overflow-hidden"
                    >
                        <Icon name="location_on" className="text-primary text-base" />
                        <span>{user.location || 'Nearby'}</span>
                    </motion.div>

                    <AnimatePresence>
                        {currentImageIndex === 0 && user.bio && (
                            <motion.p
                                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                animate={{ opacity: 1, height: 'auto', marginTop: 2 }}
                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                className="text-white/80 text-sm line-clamp-2 leading-relaxed font-medium overflow-hidden"
                            >
                                {user.bio}
                            </motion.p>
                        )}
                    </AnimatePresence>

                    {/* Interests */}
                    <AnimatePresence>
                        {currentImageIndex === 0 && user.interests && user.interests.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                className="flex flex-wrap gap-2 overflow-hidden"
                            >
                                {user.interests.slice(0, 3).map((interest: string, idx: number) => (
                                    <div key={idx} className="bg-white/10 backdrop-blur-md border border-white/5 px-3 py-1 rounded-full flex items-center">
                                        <span className="text-white/90 text-[10px] font-bold leading-none">#{interest.replace(/\s+/g, '')}</span>
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); safeNavigate(`/profile/${user.id}`); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="size-14 shrink-0 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-90"
                    >
                        <Icon name="star_rate" className="text-2xl" filled />
                    </button>

                    {/* Spy Button - Theme Highlighted */}
                    {images.some(img => img.visibility === 'PRIVATE') && (
                        <button
                            onClick={handleSpyClick}
                            onPointerDown={(e) => e.stopPropagation()}
                            disabled={isSpying}
                            className={`size-14 shrink-0 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all active:scale-90 disabled:opacity-50 relative ${isSpied ? 'text-primary border-primary/20 bg-primary/5' : 'text-white/40 hover:text-white hover:bg-white/10'}`}
                        >
                            {isSpying ? (
                                <div className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <Icon name={isSpied ? 'visibility' : 'visibility_off'} className="text-2xl" filled />
                                    {!isSpied && normalizedRole === 'PRO' && (
                                        <div className="absolute -top-1 -right-1 size-5 bg-primary rounded-full flex items-center justify-center border border-white/10 shadow-lg">
                                            <span className="text-[10px] font-black text-white leading-none">{profile?.spy_credits || 0}</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </button>
                    )}

                    <button
                        onClick={(e) => { e.stopPropagation(); safeNavigate(`/chat/${user.id}`); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="flex-1 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center gap-2 text-white hover:bg-white/20 transition-all active:scale-95"
                    >
                        <Icon name="favorite" className="text-xl text-primary" filled />
                        <span className="font-bold tracking-wide">Connect</span>
                    </button>
                </div>
            </div>
            {/* Full Screen Image Overlay */}
            <AnimatePresence>
                {isFullscreen && images.length > 0 && viewableUrls[currentImageIndex] && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-4 touch-none"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.9, y: 20, opacity: 0 }}
                            transition={{ 
                                type: "spring", 
                                stiffness: 350, 
                                damping: 25,
                                mass: 0.8
                            }}
                            className="relative w-full max-w-lg aspect-[3/4.5] rounded-[40px] overflow-hidden shadow-[0_32px_128px_rgba(0,0,0,0.8)] border border-white/10"
                        >
                            <div
                                className="absolute inset-0 bg-cover bg-center"
                                style={{ backgroundImage: `url("${viewableUrls[currentImageIndex]}")` }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                            
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-3"
                            >
                                <p className="text-white/40 text-[9px] font-bold uppercase tracking-widest animate-pulse">Release to close</p>
                            </motion.div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.article>
    );
};

export default UserDiscoveryCard;
