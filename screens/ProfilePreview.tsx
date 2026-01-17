import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';

const ProfilePreview: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    return (
        <div className="flex-1 flex flex-col min-h-screen bg-background-dark pb-24">
            <header className="flex items-center gap-4 p-4">
                <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-white/5 text-white/70">
                    <Icon name="arrow_back" />
                </button>
            </header>
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <Icon name="person" className="text-6xl text-white/10 mb-4" />
                <h1 className="text-2xl font-bold text-white mb-2">User Profile</h1>
                <p className="text-white/40 mb-4 font-mono text-xs">ID: {id}</p>
                <p className="text-white/50 max-w-xs">Detailed profile viewing coming soon!</p>
            </div>
        </div>
    );
};

export default ProfilePreview;
