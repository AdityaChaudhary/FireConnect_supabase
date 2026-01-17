import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from './Icon';

export interface MenuItem {
    label: string;
    icon: string;
    onClick: () => void;
    variant?: 'default' | 'danger';
}

interface EllipsisMenuProps {
    items: MenuItem[];
    className?: string;
}

const EllipsisMenu: React.FC<EllipsisMenuProps> = ({ items, className = '' }) => {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
        };

        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showMenu]);

    return (
        <div className={`relative ${className}`} ref={menuRef}>
            <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white hover:bg-white/10 active:scale-95 transition-all"
            >
                <Icon name="more_vert" />
            </button>
            <AnimatePresence>
                {showMenu && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        className="absolute right-0 top-12 w-56 rounded-3xl bg-surface-dark/90 backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 overflow-hidden"
                    >
                        <div className="py-2">
                            {items.map((item, index) => (
                                <button
                                    key={index}
                                    onClick={() => {
                                        item.onClick();
                                        setShowMenu(false);
                                    }}
                                    className={`flex w-full items-center gap-3 px-5 py-4 transition-colors font-semibold text-sm ${item.variant === 'danger'
                                        ? 'text-red-400 hover:bg-red-500/10'
                                        : 'text-white/70 hover:bg-white/5'
                                        }`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.variant === 'danger' ? 'bg-red-500/10' : 'bg-white/5'
                                        }`}>
                                        <Icon name={item.icon} className="text-lg" />
                                    </div>
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default EllipsisMenu;
