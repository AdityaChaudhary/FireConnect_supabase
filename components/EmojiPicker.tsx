import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Icon from './Icon';

interface EmojiPickerProps {
    onEmojiSelect: (emoji: string) => void;
    onClose: () => void;
}

const EMOJI_CATEGORIES = [
    {
        name: 'Smileys',
        icon: 'sentiment_satisfied',
        emojis: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕']
    },
    {
        name: 'Gestures',
        icon: 'front_hand',
        emojis: ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁', '👅', '👄']
    },
    {
        name: 'Hearts',
        icon: 'favorite',
        emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟']
    },
    {
        name: 'Nature',
        icon: 'eco',
        emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷', '🕸', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🗄', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿', '🦔']
    },
    {
        name: 'Activities',
        icon: 'sports_soccer',
        emojis: ['⚽️', '🏀', '🏈', '⚾️', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳️', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸', '🥌', '🎿', '⛷', '🏂', '🪂', '🏋️‍♀️', '🏋️', '🤼‍♀️', '🤼', '🤸‍♀️', '🤸', '⛹️‍♀️', '⛹️', '🤺', '🤾‍♀️', '🤾', '🏌️‍♀️', '🏌️', '🏇', '🧘‍♀️', '🧘']
    }
];

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect, onClose }) => {
    const [activeCategory, setActiveCategory] = useState(0);
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <motion.div
            ref={pickerRef}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
            className="absolute bottom-24 right-4 w-[280px] bg-surface-dark/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 overflow-hidden flex flex-col"
        >
            {/* Header / Tabs */}
            <div className="flex items-center justify-between px-2 py-2 border-b border-white/5 bg-white/5">
                {EMOJI_CATEGORIES.map((category, index) => (
                    <button
                        key={category.name}
                        onClick={() => setActiveCategory(index)}
                        className={`flex-1 flex items-center justify-center p-2 rounded-xl transition-all ${activeCategory === index ? 'bg-primary text-white' : 'text-white/40 hover:text-white/60 hover:bg-white/5'}`}
                    >
                        <Icon name={category.icon} className="text-[20px]" />
                    </button>
                ))}
            </div>

            {/* Emoji Grid */}
            <div className="h-[250px] overflow-y-auto p-3 grid grid-cols-6 gap-2 scrollbar-hide">
                {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, index) => (
                    <button
                        key={index}
                        onClick={() => onEmojiSelect(emoji)}
                        className="flex items-center justify-center text-2xl p-1 rounded-lg hover:bg-white/10 active:scale-90 transition-all"
                    >
                        {emoji}
                    </button>
                ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-white/5 bg-white/5 flex items-center justify-between">
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{EMOJI_CATEGORIES[activeCategory].name}</span>
                <button 
                    onClick={onClose}
                    className="text-[10px] font-bold text-primary uppercase tracking-widest"
                >
                    Close
                </button>
            </div>
        </motion.div>
    );
};

export default EmojiPicker;
