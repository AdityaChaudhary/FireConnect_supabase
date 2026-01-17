import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from './Icon';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getDefaultAvatar } from '../lib/image-utils';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver';

interface UserDiscoveryCardProps {
    user: any;
    onUpgradeClick?: (mode: 'UPGRADE' | 'OUT_OF_CREDITS') => void;
}

const UserDiscoveryCard: React.FC<UserDiscoveryCardProps> = ({ user, onUpgradeClick }) => {
    const { stripeRole, profile, refreshProfile, user: authUser } = useAuth();
    const [images, setImages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [viewableUrls, setViewableUrls] = useState<Record<number, string>>({});
    const [blurredViewableUrls, setBlurredViewableUrls] = useState<Record<number, string>>({});
    const [imageLoading, setImageLoading] = useState(false);
    const [isRevealed, setIsRevealed] = useState(false);
    const [isSpied, setIsSpied] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(Date.now());

    const { targetRef, hasBeenInView } = useIntersectionObserver({
        rootMargin: '200px',
    });

    const isProOrMax = stripeRole === 'PRO' || stripeRole === 'MAX';

    useEffect(() => {
        const intervalId = setInterval(() => {
            setCurrentTime(Date.now());
        }, 30000);
        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        if (!hasBeenInView) return;

        const fetchImages = async () => {
            try {
                const { data, error } = await supabase
                    .from('profile_images')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('is_profile', { ascending: false })
                    .order('display_order', { ascending: true });

                if (error) throw error;

                if ((!data || data.length === 0) && user.profile_picture_url) {
                    setImages([{
                        id: 'profile',
                        url: user.profile_picture_url,
                        visibility: 'PUBLIC',
                        is_profile: true,
                        blurred_url: null
                    }]);
                } else {
                    setImages(data || []);
                }
            } catch (error) {
                console.error("Error fetching images for user", user.id, error);
            } finally {
                setLoading(false);
            }
        };

        fetchImages();
    }, [user.id, user.profile_picture_url, hasBeenInView]);

    useEffect(() => {
        if (!hasBeenInView || !authUser) return;

        const checkSpied = async () => {
            if (!stripeRole || stripeRole === 'FREE') return;
            try {
                const { data, error } = await supabase
                    .from('spied_profiles')
                    .select('*')
                    .eq('target_user_id', user.id)
                    .eq('user_id', authUser.id)
                    .maybeSingle();

                if (data) {
                    setIsSpied(true);
                    if (stripeRole !== 'MAX') {
                        setIsRevealed(true);
                    }
                }
            } catch (error) {
                console.error("Error checking spied status", error);
            }
        };
        checkSpied();
    }, [user.id, stripeRole, hasBeenInView, authUser]);

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

            images.forEach((img, idx) => {
                const isPrivate = img.visibility === 'PRIVATE';
                const canFetchPrivate = stripeRole === 'MAX' || (stripeRole === 'PRO' && isSpied);

                if (img.blurred_url && !bUrls[idx]) {
                    const { data } = supabase.storage.from('profile-images').getPublicUrl(img.blurred_url);
                    bUrls[idx] = data.publicUrl;
                }

                if ((!isPrivate || canFetchPrivate) && !vUrls[idx]) {
                    const { data } = supabase.storage.from('profile-images').getPublicUrl(img.url);
                    vUrls[idx] = data.publicUrl;
                }
            });

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

        if (currentRole === 'MAX') {
            setIsRevealed(true);
            setIsSpied(true);
            const privateIdx = images.findIndex(img => img.visibility === 'PRIVATE');
            if (privateIdx !== -1) setCurrentImageIndex(privateIdx);
            return;
        }

        if (currentRole === 'PRO') {
            if (isSpied) {
                setIsRevealed(true);
                const privateIdx = images.findIndex(img => img.visibility === 'PRIVATE');
                if (privateIdx !== -1) setCurrentImageIndex(privateIdx);
                return;
            }

            const currentCredits = Number(profile?.spy_credits || 0);
            if (currentCredits > 0) {
                try {
                    const { error: spyError } = await supabase
                        .from('spied_profiles')
                        .insert({ target_user_id: user.id, user_id: authUser?.id });

                    if (spyError) throw spyError;

                    const { error: creditError } = await supabase
                        .from('users')
                        .update({ spy_credits: currentCredits - 1 })
                        .eq('id', authUser?.id);

                    if (creditError) throw creditError;

                    await refreshProfile();
                    setIsSpied(true);
                    setIsRevealed(true);
                    setNotification(`Spying: Private photos unlocked!`);

                    const privateIdx = images.findIndex(img => img.visibility === 'PRIVATE');
                    if (privateIdx !== -1) {
                        setTimeout(() => setCurrentImageIndex(privateIdx), 100);
                    }
                } catch (error) {
                    console.error("Error revealing profile", error);
                    setNotification("Failed to spy. Please try again.");
                }
            } else {
                onUpgradeClick?.('OUT_OF_CREDITS');
            }
        } else {
            onUpgradeClick?.('UPGRADE');
        }
    };

    const handleDragEnd = (_e: any, info: any) => {
        const swipeThreshold = 50;
        if (info.offset.x < -swipeThreshold && currentImageIndex < images.length - 1) {
            setCurrentImageIndex(prev => prev + 1);
        } else if (info.offset.x > swipeThreshold && currentImageIndex > 0) {
            setCurrentImageIndex(prev => prev - 1);
        }
    };

    const getOnlineStatus = () => {
        const lastSeen = user.user_online_status?.[0]?.last_seen_at;
        if (!lastSeen) return null;

        const seenDate = new Date(lastSeen).getTime();
        const diffInMinutes = Math.floor((currentTime - seenDate) / (1000 * 60));

        if (diffInMinutes < 5) {
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
            onDragEnd={handleDragEnd}
            className="flex flex-col bg-surface-dark rounded-[32px] mx-4 overflow-hidden shadow-2xl relative aspect-[3/4.2] cursor-grab active:cursor-grabbing"
        >
            <AnimatePresence>
                {loading && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 bg-background-dark flex items-center justify-center"
                    >
                        <div className="flex flex-col items-center gap-4">
                            <Icon name="image" className="text-white/10 text-[64px]" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="absolute inset-0 z-0">
                <div
                    className="flex h-full transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
                >
                    {images.length === 0 ? (
                        <div className="relative flex-shrink-0 w-full h-full bg-black/40 flex items-center justify-center">
                            <Icon name="image" className="text-white/20 text-4xl" />
                        </div>
                    ) : images.map((img, idx) => {
                        const isPrivate = img.visibility === 'PRIVATE';
                        const isRevealedPrivate = isRevealed && isSpied;
                        const showSpyOverlay = isPrivate && !isRevealedPrivate;
                        const viewUrl = viewableUrls[idx];
                        const blurUrl = blurredViewableUrls[idx];

                        return (
                            <div key={img.id || idx} className="relative flex-shrink-0 w-full h-full">
                                {blurUrl && (showSpyOverlay || !viewUrl) && (
                                    <div
                                        className="absolute inset-0 bg-cover bg-center blur-2xl scale-110"
                                        style={{ backgroundImage: `url("${blurUrl}")` }}
                                    ></div>
                                )}
                                {viewUrl && (
                                    <div
                                        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ${showSpyOverlay ? 'opacity-0' : 'opacity-100'}`}
                                        style={{ backgroundImage: `url("${viewUrl}")` }}
                                    ></div>
                                )}
                                {showSpyOverlay && (
                                    <div
                                        className="absolute inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center cursor-pointer z-20"
                                        onClick={handleSpyClick}
                                    >
                                        <div className="text-center">
                                            <Icon name="visibility_off" className="text-white/60 text-3xl mb-4" />
                                            <p className="text-white font-bold">Private Media</p>
                                            <p className="text-white/50 text-xs text-uppercase tracking-widest mt-1">Touch to Spy</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="absolute inset-y-0 left-0 w-1/4 z-30 flex items-center" onClick={handlePrevImage}></div>
                <div className="absolute inset-y-0 right-0 w-1/4 z-30 flex items-center" onClick={handleNextImage}></div>
            </div>

            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40 pointer-events-none z-[1]"></div>

            <div className="absolute top-0 left-0 right-0 p-5 z-20 flex justify-between items-start">
                <div className="flex flex-col gap-2">
                    {onlineStatus && (
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full backdrop-blur-md border border-white/10 ${onlineStatus.color}`}>
                            <div className="size-1.5 rounded-full bg-white"></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-white">{onlineStatus.label}</span>
                        </div>
                    )}
                </div>

                {images.length > 1 && (
                    <div className="flex flex-col gap-2 p-1.5 rounded-full bg-black/20 backdrop-blur-sm border border-white/5">
                        {images.map((_, idx) => (
                            <div
                                key={idx}
                                className={`size-1.5 rounded-full transition-all ${idx === currentImageIndex ? 'bg-white scale-125 shadow-lg' : 'bg-white/20'}`}
                            ></div>
                        ))}
                    </div>
                )}
            </div>

            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: -20, x: '-50%' }}
                        className="absolute top-20 left-1/2 z-30 bg-primary/90 text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider"
                    >
                        {notification}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
                <div className="flex flex-col gap-1 mb-6">
                    <h2 className="text-white text-3xl font-extrabold tracking-tight">
                        {user.display_name || user.username}
                    </h2>
                    <div className="flex items-center gap-1.5 text-white/70 text-sm">
                        <Icon name="location_on" className="text-primary text-base" />
                        <span>{user.location || 'Nearby'}</span>
                    </div>
                    {user.bio && (
                        <p className="text-white/80 text-sm mt-2 line-clamp-2 leading-relaxed">
                            {user.bio}
                        </p>
                    )}
                    {user.interests && user.interests.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                            {user.interests.slice(0, 3).map((interest: string, idx: number) => (
                                <span key={idx} className="bg-white/10 backdrop-blur-md border border-white/5 px-2.5 py-0.5 rounded-full text-[10px] text-white/90 font-bold">
                                    #{interest.replace(/\s+/g, '')}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={(e) => { e.stopPropagation(); window.location.hash = `#/profile/${user.id}`; }}
                        className="size-14 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all active:scale-90"
                    >
                        <Icon name="person" className="text-2xl" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); window.location.hash = `#/chat/${user.id}`; }}
                        className="flex-1 h-14 rounded-full bg-primary flex items-center justify-center gap-2 text-white font-bold tracking-wide shadow-lg shadow-primary/20 active:scale-95 transition-all"
                    >
                        <Icon name="favorite" className="text-xl" filled />
                        <span>Connect</span>
                    </button>
                </div>
            </div>
        </motion.article>
    );
};

export default UserDiscoveryCard;
