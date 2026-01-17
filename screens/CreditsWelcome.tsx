import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';

const CreditsWelcome: React.FC = () => {
    const navigate = useNavigate();
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6">
                <Icon name="bolt" className="text-4xl text-primary" filled />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">Credits Added!</h1>
            <p className="text-white/60 mb-8 max-w-xs">Your Spy Credits have been added to your account.</p>
            <button
                onClick={() => navigate('/profile')}
                className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all"
            >
                Back to Profile
            </button>
        </div>
    );
};

export default CreditsWelcome;
