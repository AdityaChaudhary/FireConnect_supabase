import React from 'react';
import Icon from '../components/Icon';

const ChatList: React.FC = () => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <Icon name="chat" className="text-6xl text-primary/20 mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Messages</h1>
            <p className="text-white/50 max-w-xs">Your conversations will appear here. Coming soon!</p>
        </div>
    );
};

export default ChatList;
