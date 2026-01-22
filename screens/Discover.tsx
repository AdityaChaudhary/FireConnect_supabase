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



const Discover: React.FC = () => {
    const { user: authUser, profile, stripeRole } = useAuth();
    const { safeNavigate } = useSafeNavigate();
    const {
        data,
        isLoading: loading,
        isFetching,
        isFetchingNextPage,
        fetchNextPage,
        hasNextPage
    } = useDiscoveryUsers(authUser?.id);

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

    React.useEffect(() => {
        const savedScroll = localStorage.getItem(scrollKey);
        if (savedScroll && users.length > 0) {
            // Wait for items to be rendered
            const timer = setTimeout(() => {
                window.scrollTo({
                    top: parseInt(savedScroll),
                    behavior: 'auto'
                });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [users.length, scrollKey]);

    React.useEffect(() => {
        const handleScroll = () => {
            // Save scroll position
            localStorage.setItem(scrollKey, window.scrollY.toString());
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [scrollKey]);

    if (loading && users.length === 0) {
        return (
            <div className="min-h-screen w-full bg-background-dark flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-background-dark lg:h-screen lg:overflow-hidden lg:pb-0">
            {/* Header (Desktop: Hidden or integrated into sidebar/top, Mobile: Sticky) */}
            <header className="sticky top-0 z-50 flex items-center justify-between p-4 bg-background-dark/95 backdrop-blur-md border-b border-white/5 lg:bg-transparent lg:border-none lg:p-6 lg:static">
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
                    <NotificationIcon />
                </div>
            </header>

            {/* Mobile spacing */}
            <div className="h-4 lg:hidden"></div>

            <main className="flex-1 lg:overflow-y-auto lg:hide-scrollbar">
                <section className="flex flex-col gap-8 pb-24 px-4 lg:px-6 lg:pb-12 lg:max-w-4xl lg:mx-auto lg:pt-4">
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
                                            onUpgradeClick={(mode) => {
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
