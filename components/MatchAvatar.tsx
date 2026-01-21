import React from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import CdnImage from './CdnImage';
import { getDefaultAvatar } from '../lib/image-utils';

interface MatchAvatarProps {
    user: any;
    thread?: any;
    isUnread?: boolean;
}

const MatchAvatar: React.FC<MatchAvatarProps> = ({ user, thread, isUnread }) => {
    const navigate = useNavigate();

    const handleClick = () => {
        navigate(`/chat/${user.id}`, {
            state: {
                user: {
                    name: user.display_name,
                    avatar: user.profile_picture_url || getDefaultAvatar(user.gender, user.id),
                    userType: user.user_type,
                    isTheyMax: user.stripe_role === 'MAX' || user.user_type === 'AI'
                },
                thread: thread
            }
        });
    };

    return (
        <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleClick}
            className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer group pb-1"
        >
            <div className="relative">
                {/* Gradient ring */}
                <div className={`size-[70px] rounded-full p-[3px] bg-gradient-to-tr ${isUnread ? 'from-primary via-neon-purple to-fire-pink animate-pulse-slow' : 'from-white/10 to-white/5 group-hover:from-primary/50 group-hover:to-neon-purple/50'} transition-all duration-500`}>
                    <div className="w-full h-full rounded-full overflow-hidden border-2 border-background-dark bg-surface-dark shadow-inner">
                        <CdnImage
                            path={user.profile_picture_url}
                            gender={user.gender}
                            seed={user.id}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                        />
                    </div>
                </div>
                
                {/* Online Indicator */}
                <div className="absolute bottom-0.5 right-0.5 size-4 bg-green-500 border-[3px] border-background-dark rounded-full shadow-lg"></div>
                
                {/* Unread Glow */}
                {isUnread && (
                    <div className="absolute inset-0 rounded-full bg-primary/20 blur-md -z-10 animate-pulse"></div>
                )}
            </div>
            <span className="text-[11px] font-bold text-white/50 truncate w-16 text-center group-hover:text-white transition-colors duration-300 tracking-tight">
                {user.display_name?.split(' ')[0] || user.username}
            </span>
        </motion.div>
    );
};

export default MatchAvatar;
