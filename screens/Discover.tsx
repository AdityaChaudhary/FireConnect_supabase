import React, { useState } from 'react';
import Icon from '../components/Icon';
import { useSafeNavigate } from '../hooks/useSafeNavigate';
import NotificationIcon from '../components/NotificationIcon';
import UserDiscoveryCard from '../components/UserDiscoveryCard';
import UpgradeModal from '../components/UpgradeModal';
import { useAuth } from '../context/AuthContext';
import { useDiscoveryUsers, useSpiedUserIds } from '../hooks/useData';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver';
import CdnImage from '../components/CdnImage';
import { useQueryClient } from '@tanstack/react-query';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';



const Discover: React.FC = () => {
    const { user: authUser, profile, stripeRole } = useAuth();
    const { safeNavigate } = useSafeNavigate();
    const mainRef = React.useRef<HTMLElement>(null);

    // Use a stable seed for randomization during a single session (or until refresh)
    const [discoverySeed, setDiscoverySeed] = useState(() => {
        if (typeof window === 'undefined') return Math.random().toString(36).substring(7);
        
        const EXPIRE_TIME = 15 * 60 * 1000; // 15 minutes
        const now = Date.now();
        const savedData = sessionStorage.getItem('discovery_seed_data');
        
        if (savedData) {
            try {
                const { seed, timestamp } = JSON.parse(savedData);
                if (now - timestamp < EXPIRE_TIME) {
                    return seed;
                }
            } catch (e) {
                console.error("Error parsing discovery seed data:", e);
            }
        }
        
        const newSeed = Math.random().toString(36).substring(7);
        sessionStorage.setItem('discovery_seed_data', JSON.stringify({
            seed: newSeed,
            timestamp: now
        }));
        return newSeed;
    });

    const queryClient = useQueryClient();

    const handleRefresh = async () => {
        const newSeed = Math.random().toString(36).substring(7);
        sessionStorage.setItem('discovery_seed_data', JSON.stringify({
            seed: newSeed,
            timestamp: Date.now()
        }));
        setDiscoverySeed(newSeed);
        // Reset scroll position on refresh
        localStorage.removeItem(scrollKey);
        if (mainRef.current) {
            mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        // Invalidate queries to fetch fresh data
        await queryClient.invalidateQueries({ queryKey: ['discovery-users'] });
    };

    // Pull to Refresh Logic
    const pullY = useMotionValue(0);
    const pullOpacity = useTransform(pullY, [0, 40, 80], [0, 0.5, 1]);
    const pullScale = useTransform(pullY, [0, 80], [0.6, 1]);
    const pullRotate = useTransform(pullY, [0, 100], [0, 360]);
    const [isPulling, setIsPulling] = useState(false);
    const startY = React.useRef(0);
    const threshold = 80;

    const handleTouchStart = (e: React.TouchEvent) => {
        const currentScroll = mainRef.current?.scrollTop ?? 0;

        if (currentScroll <= 0) {
            startY.current = e.touches[0].clientY;
            setIsPulling(true);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isPulling) return;
        const currentY = e.touches[0].clientY;
        const diff = currentY - startY.current;

        if (diff > 0) {
            // Apply resistance: diff grows slower as it gets larger
            const resistance = 0.4;
            const y = diff * resistance;
            pullY.set(y);

            // Prevent default browser behavior (bouncing/scrolling) when pulling down from top
            if (y > 5 && e.cancelable) {
                e.preventDefault();
            }
        } else {
            pullY.set(0);
            setIsPulling(false);
        }
    };

    const handleTouchEnd = () => {
        if (!isPulling) return;
        const currentPull = pullY.get();
        if (currentPull >= threshold) {
            handleRefresh();
        }
        animate(pullY, 0, { type: 'spring', stiffness: 300, damping: 30 });
        setIsPulling(false);
    };

    const headerVisible = useMotionValue(1); // 1 = visible, 0 = hidden
    const lastScrollY = React.useRef(0);
    const scrollUpDistance = React.useRef(0);
    const SHOW_HEADER_THRESHOLD = 50; // Distance to scroll up before showing header

    const headerY = useTransform(headerVisible, [0, 1], ["-100%", "0%"]);
    const headerOpacity = useTransform(headerVisible, [0, 1], [0, 1]);

    const {
        data,
        isLoading: loading,
        isFetching,
        isFetchingNextPage,
        fetchNextPage,
        hasNextPage
    } = useDiscoveryUsers(authUser?.id, discoverySeed);

    const { data: spiedUserIds = [] } = useSpiedUserIds(authUser?.id);

    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'UPGRADE' | 'OUT_OF_CREDITS'>('UPGRADE');

    const { targetRef: loadMoreRef, isIntersecting: inView } = useIntersectionObserver({
        threshold: 0,
        rootMargin: '200px', // Trigger slightly before reaching the bottom
        triggerOnce: false,
    });

    const users = data?.pages.flatMap(page => page) || [];

    React.useEffect(() => {
        if (isFetchingNextPage) {
            console.log('🔄 Infinite Scroll: Fetching next page...');
        }
    }, [isFetchingNextPage]);

    React.useEffect(() => {
        if (inView && hasNextPage && !isFetchingNextPage && !isFetching) {
            fetchNextPage();
        }
    }, [inView, hasNextPage, isFetchingNextPage, isFetching, fetchNextPage]);

    // Scroll Position Persistence
    const scrollKey = `discover_scroll_${authUser?.id}`;
    const hasRestoredInitialScroll = React.useRef(false);

    React.useLayoutEffect(() => {
        const savedScroll = localStorage.getItem(scrollKey);
        if (savedScroll && users.length > 0 && mainRef.current && !hasRestoredInitialScroll.current) {
            const top = parseInt(savedScroll);
            mainRef.current.scrollTop = top;
            lastScrollY.current = top;
            hasRestoredInitialScroll.current = true;
            console.log("Scroll restored to:", top);
        }
    }, [users.length, scrollKey]);

    React.useEffect(() => {
        const container = mainRef.current;
        if (!container) return;

        const handleScroll = () => {
            if (!container) return;
            //console.log("Scrolling Discover list...");
            const latest = container.scrollTop;
            const diff = latest - lastScrollY.current;
            
            // Header hide logic (downward scroll)
            // Even a small positive diff should hide if we are past the very top
            if (diff > 0.5 && latest > 15) {
                if (headerVisible.get() === 1) {
                    animate(headerVisible, 0, { duration: 0.2, ease: "easeInOut" });
                    console.log("Header hidden");
                }
                scrollUpDistance.current = 0;
            } 
            // Header show logic (upward scroll)
            else if (diff < -0.5) {
                scrollUpDistance.current += Math.abs(diff);
                // Show if we've scrolled up enough or reached the top
                if (scrollUpDistance.current > SHOW_HEADER_THRESHOLD || latest < 10) {
                    if (headerVisible.get() === 0) {
                        animate(headerVisible, 1, { duration: 0.2, ease: "easeInOut" });
                        console.log("Header shown");
                    }
                    scrollUpDistance.current = 0; // Reset after showing
                }
            }

            lastScrollY.current = latest;
            // Save scroll position
            localStorage.setItem(scrollKey, latest.toString());
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [scrollKey, headerVisible, loading, users.length]);

    if (loading && users.length === 0) {
        return (
            <div className="min-h-screen w-full bg-background-dark flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-background-dark overflow-hidden">
            {/* Header (Desktop: Hidden or integrated into sidebar/top, Mobile: Sticky) */}
            <motion.header 
                style={{ y: headerY, opacity: headerOpacity }}
                className="fixed top-0 left-0 right-0 z-50 bg-background-dark/95 backdrop-blur-md lg:bg-transparent lg:border-none lg:static"
            >
                <div className="flex items-center justify-between w-full p-4 lg:p-6 max-w-sm mx-auto lg:max-w-none border-b border-white/5 lg:border-none">
                    <div className="flex items-center lg:hidden">
                        <div className="relative group cursor-pointer z-0" onClick={() => safeNavigate('/profile')}>
                            <CdnImage
                                path={profile?.profile_picture_url}
                                gender={profile?.gender}
                                seed={authUser?.id}
                                className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 ring-2 ring-white/10"
                                useAsBackground
                            />
                            <div className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full border-2 border-[#160a11]"></div>
                        </div>

                        {/* Subscription Badge */}
                        <div className={`relative z-10 -ml-3 px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase border backdrop-blur-md transition-all duration-500 hover:z-20 hover:scale-105 cursor-default
                            ${(stripeRole || '').toLowerCase() === 'max' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]' :
                                (stripeRole || '').toLowerCase() === 'pro' ? 'bg-primary/10 border-primary/30 text-primary shadow-[0_0_15px_rgba(236,19,146,0.2)]' :
                                    'bg-white/5 border-white/10 text-white/40'}`}>
                            {stripeRole || 'LITE'}
                        </div>
                    </div>

                    <div className="hidden lg:flex flex-col gap-1">
                        <h1 className="text-3xl font-bold text-white tracking-tight">Discovery</h1>
                        {/* <p className="text-white/40 text-sm font-medium">Find your perfect connection nearby</p> */}
                    </div>

                    <h1 className="absolute left-1/2 -translate-x-1/2 text-2xl font-bold bg-gradient-to-r from-white via-primary/80 to-primary bg-clip-text text-transparent tracking-tight lg:hidden">
                        FireConnect
                        {isFetching && !loading && (
                            <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary/30 animate-pulse rounded-full"></span>
                        )}
                    </h1>

                    <div className="flex items-center gap-3">
                        {/* <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold text-white/60">
                             <div className="size-1.5 rounded-full bg-green-500 animate-pulse"></div>
                             <span>12 miles away</span>
                        </div>
                        <button className="hidden lg:flex size-10 items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white transition-all">
                            <Icon type="lucide" name="Filter" size={18} />
                        </button> */}
                        
                        <button
                            onClick={handleRefresh}
                            className="hidden lg:flex size-10 items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all group relative"
                            title="Refresh Feed"
                        >
                            <Icon type="lucide" name="RefreshCw" size={18} className={isFetching && !isFetchingNextPage ? 'animate-spin' : ''} />
                            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap border border-white/10 backdrop-blur-sm z-[100]">
                                Refresh Feed
                            </div>
                        </button>
                        <NotificationIcon />
                    </div>
                </div>
            </motion.header>

            <main
                ref={mainRef}
                className="flex-1 overflow-y-auto hide-scrollbar relative overscroll-behavior-y-none pt-[95px] lg:pt-0"
                style={{ overscrollBehaviorY: 'none' }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Pull to Refresh Indicator */}
                <motion.div
                    style={{
                        y: pullY,
                        opacity: pullOpacity,
                        scale: pullScale,
                    }}
                    className="absolute top-0 left-0 right-0 h-20 flex items-center justify-center pointer-events-none z-[100]"
                >
                    <div className="bg-primary/20 backdrop-blur-md border border-primary/30 p-2 rounded-full shadow-lg">
                        <motion.div style={{ rotate: pullRotate }}>
                            <Icon type="lucide" name="RefreshCw" size={24} className="text-primary" />
                        </motion.div>
                    </div>
                </motion.div>

                <section className="flex flex-col gap-8 pb-24 px-4 lg:px-6 lg:pb-12 lg:max-w-4xl lg:mx-auto">
                    {users.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-white/50">
                            <Icon name="person_off" className="text-[48px] mb-4" />
                            <p>No new users found nearby.</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
                                {users.map((user, idx) => (
                                    <div key={`${user.id}-${idx}`} className="w-full max-w-sm mx-auto lg:max-w-none">
                                        <UserDiscoveryCard
                                            user={user}
                                            isSpiedInitially={spiedUserIds.includes(user.id)}
                                            onUpgradeClick={(mode: 'UPGRADE' | 'OUT_OF_CREDITS') => {
                                                setModalMode(mode);
                                                setIsUpgradeModalOpen(true);
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Pagination Trigger / Loading Indicator */}
                            <div ref={loadMoreRef} className="py-12 flex flex-col items-center justify-center gap-4">
                                {(isFetchingNextPage || (inView && hasNextPage)) ? (
                                    <>
                                        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                                        <p className="text-primary text-sm font-medium animate-pulse">Loading more profiles...</p>
                                    </>
                                ) : hasNextPage ? (
                                    <div className="h-20"></div> // Taller sentinel
                                ) : users.length > 0 ? (
                                    <div className="flex flex-col items-center gap-2 py-4">
                                        <div className="w-12 h-[1px] bg-white/10"></div>
                                        <p className="text-white/20 text-xs font-medium italic">No more users found nearby</p>
                                    </div>
                                ) : null}
                            </div>
                        </>
                    )}
                </section>
            </main>

            <UpgradeModal
                isOpen={isUpgradeModalOpen}
                onClose={() => setIsUpgradeModalOpen(false)}
                mode={modalMode}
            />
        </div>
    );
};

export default Discover;
