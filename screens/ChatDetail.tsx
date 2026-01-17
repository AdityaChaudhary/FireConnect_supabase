import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';

const ChatDetail: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    return (
        <div className="flex-1 flex flex-col h-screen bg-background-dark">
            <header className="flex items-center gap-4 p-4 border-b border-white/5">
                <button onClick={() => navigate(-1)} className="text-white/70 hover:text-white">
                    <Icon name="arrow_back" />
                </button>
                <div className="flex-1">
                    <h1 className="text-white font-bold">Chat</h1>
                    <p className="text-white/40 text-xs">ID: {id}</p>
                </div>
            </header>
            <div className="flex-1 flex items-center justify-center p-6 text-center">
                <p className="text-white/30 italic">Conversation details coming soon...</p>
            </div>
        </div>
    );
};

export default ChatDetail;
