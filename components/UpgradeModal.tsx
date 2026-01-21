import React from 'react';
import { useNavigate } from 'react-router';
import Icon from './Icon';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode?: 'UPGRADE' | 'OUT_OF_CREDITS';
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, mode = 'UPGRADE' }) => {
    const navigate = useNavigate();

    if (!isOpen) return null;

    const handleActionClick = () => {
        onClose();
        if (mode === 'OUT_OF_CREDITS') {
            navigate('/purchase-credits');
        } else {
            navigate('/subscription');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onClose}
            ></div>

            <div className="relative w-full max-w-sm bg-surface-dark/90 border border-white/10 rounded-[2.5rem] shadow-2xl backdrop-blur-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 size-40 bg-primary/20 blur-[60px] rounded-full pointer-events-none"></div>

                <div className="p-8 flex flex-col items-center text-center">
                    <div className="size-20 rounded-3xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center mb-6 shadow-lg shadow-primary/20">
                        <Icon name="visibility" className="text-white text-[40px]" filled />
                    </div>

                    <h2
                        className="text-3xl font-black text-white mb-4 tracking-normal italic uppercase"
                        style={{ wordSpacing: '0.2em' }}
                    >
                        {mode === 'OUT_OF_CREDITS' ? 'You have run out of Spy Credits' : 'Unlock Spy Mode'}
                    </h2>
                    <p className="text-white/60 text-base font-medium leading-relaxed mb-8 px-2 lowercase">
                        {mode === 'OUT_OF_CREDITS'
                            ? "GET MORE CREDITS TO REVEAL PRIVATE PHOTOS AND SEE WHO'S REALLY BEHIND THE BLUR."
                            : <span>UPGRADE TO <span className="text-primary font-bold uppercase">PRO</span> OR <span className="text-purple-400 font-bold uppercase">MAX</span> TO REVEAL PRIVATE PHOTOS AND SEE WHO'S REALLY BEHIND THE BLUR.</span>
                        }
                    </p>

                    <button
                        onClick={handleActionClick}
                        className="w-full h-16 rounded-2xl bg-primary text-white font-bold text-lg uppercase tracking-wider hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/20 mb-4"
                    >
                        {mode === 'OUT_OF_CREDITS' ? 'Buy More Credits' : 'Upgrade Now'}
                    </button>

                    <button
                        onClick={onClose}
                        className="text-white/40 font-bold text-sm uppercase tracking-widest hover:text-white/60 transition-colors"
                    >
                        Maybe Later
                    </button>
                </div>

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 size-10 flex items-center justify-center rounded-full text-white/20 hover:text-white/40 hover:bg-white/5 transition-all"
                >
                    <Icon name="close" className="text-[20px]" />
                </button>
            </div>
        </div>
    );
};

export default UpgradeModal;
