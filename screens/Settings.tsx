import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';

const Settings: React.FC = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="flex min-h-screen w-full flex-col bg-background-dark text-white pb-24">
            {/* Header */}
            <header className="sticky top-0 z-20 flex w-full items-center gap-4 bg-background-dark/80 px-4 py-3 backdrop-blur-md border-b border-white/5">
                <button
                    onClick={() => navigate(-1)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-dark text-white hover:bg-white/10 active:scale-95 transition-all"
                >
                    <Icon name="arrow_back" />
                </button>
                <span className="text-lg font-bold tracking-tight">Settings</span>
            </header>

            <main className="flex-1 flex flex-col px-4 pt-6 gap-6 w-full max-w-md mx-auto">

                {/* Account Settings Section */}
                <div className="flex flex-col gap-2">
                    <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider px-2">Account</h3>
                    <div className="flex flex-col rounded-2xl bg-surface-dark overflow-hidden border border-white/5">
                        <button className="flex w-full items-center justify-between p-4 active:bg-white/5 transition-colors text-left group">
                            <div className="flex items-center gap-3">
                                <Icon name="lock" className="text-white/60 group-hover:text-primary transition-colors" />
                                <span className="text-sm font-medium">Privacy</span>
                            </div>
                            <Icon name="chevron_right" className="text-white/40" />
                        </button>
                        <div className="h-px w-full bg-white/5"></div>
                        <button className="flex w-full items-center justify-between p-4 active:bg-white/5 transition-colors text-left group">
                            <div className="flex items-center gap-3">
                                <Icon name="notifications" className="text-white/60 group-hover:text-primary transition-colors" />
                                <span className="text-sm font-medium">Notifications</span>
                            </div>
                            <Icon name="chevron_right" className="text-white/40" />
                        </button>
                    </div>
                </div>

                {/* Support Section */}
                <div className="flex flex-col gap-2">
                    <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider px-2">Support</h3>
                    <div className="flex flex-col rounded-2xl bg-surface-dark overflow-hidden border border-white/5">
                        <button className="flex w-full items-center justify-between p-4 active:bg-white/5 transition-colors text-left group">
                            <div className="flex items-center gap-3">
                                <Icon name="help" className="text-white/60 group-hover:text-primary transition-colors" />
                                <span className="text-sm font-medium">Help Center</span>
                            </div>
                            <Icon name="chevron_right" className="text-white/40" />
                        </button>
                    </div>
                </div>

                {/* Sign Out Button */}
                <button
                    onClick={async () => {
                        await logout();
                        navigate('/');
                    }}
                    className="mt-4 flex w-full items-center justify-center rounded-xl bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 text-red-400 p-4 border border-red-500/20 transition-colors gap-2"
                >
                    <Icon name="logout" className="text-[20px]" />
                    <span className="text-sm font-bold">Sign Out</span>
                </button>

                <div className="mt-8 text-center">
                    <p className="text-white/20 text-xs">FireConnect v1.0.0</p>
                </div>
            </main>
        </div>
    );
};

export default Settings;
