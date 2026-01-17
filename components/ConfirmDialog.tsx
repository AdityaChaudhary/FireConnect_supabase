import React from 'react';
import Icon from './Icon';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'primary';
    loading?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    type = 'primary',
    loading = false
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-surface-dark border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-6 flex flex-col items-center text-center gap-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center ${type === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'}`}>
                        <Icon name={type === 'danger' ? 'warning' : 'info'} className="text-3xl" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-xl font-bold text-white uppercase tracking-tight">{title}</h3>
                        <p className="text-white/50 text-sm leading-relaxed">{message}</p>
                    </div>
                </div>
                <div className="p-4 bg-black/20 flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 px-4 py-3 rounded-xl border border-white/5 text-white/50 text-sm font-bold uppercase transition-all hover:bg-white/5 active:scale-95 disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className={`flex-1 px-4 py-3 rounded-xl text-white text-sm font-bold uppercase transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 ${type === 'danger' ? 'bg-red-600 shadow-lg shadow-red-600/20' : 'bg-primary shadow-lg shadow-primary/20'
                            }`}
                    >
                        {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
