import React, { useState } from 'react';
import Icon from '../components/Icon';
import NotificationIcon from '../components/NotificationIcon';
import UserDiscoveryCard from '../components/UserDiscoveryCard';
import UpgradeModal from '../components/UpgradeModal';
import { useAuth } from '../context/AuthContext';
import { useDiscoveryUsers } from '../hooks/useData';
import CdnImage from '../components/CdnImage';

const Discover: React.FC = () => {
    const { user: authUser, profile, stripeRole } = useAuth();
    const { data: users = [], isLoading: loading, isFetching } = useDiscoveryUsers(authUser?.id);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'UPGRADE' | 'OUT_OF_CREDITS'>('UPGRADE');

    if (loading && users.length === 0) {
        return (
            <div className="min-h-screen w-full bg-background-dark flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col pb-24 min-h-screen bg-background-dark">
            <header className="sticky top-0 z-50 flex items-center justify-between p-4 bg-background-dark/95 backdrop-blur-md transition-all duration-300 border-b border-white/5">
                <div className="flex items-center">
                    <div className="relative group cursor-pointer z-0" onClick={() => window.location.hash = '#/profile'}>
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
                <h1 className="absolute left-1/2 -translate-x-1/2 text-2xl font-bold bg-gradient-to-r from-white via-primary/80 to-primary bg-clip-text text-transparent tracking-tight">
                    FireConnect
                    {isFetching && !loading && (
                        <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary/30 animate-pulse rounded-full"></span>
                    )}
                </h1>
                <NotificationIcon />
            </header>

            <div className="h-4"></div>

            <main className="flex flex-col gap-8">
                {users.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-white/50">
                        <Icon name="person_off" className="text-[48px] mb-4" />
                        <p>No new users found nearby.</p>
                    </div>
                ) : (
                    users.map(user => (
                        <UserDiscoveryCard
                            key={user.id}
                            user={user}
                            onUpgradeClick={(mode) => {
                                setModalMode(mode);
                                setIsUpgradeModalOpen(true);
                            }}
                        />
                    ))
                )}
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
