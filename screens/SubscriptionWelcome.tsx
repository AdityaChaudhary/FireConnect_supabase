import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';

const SubscriptionWelcome: React.FC = () => {
    const navigate = useNavigate();
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6">
                <Icon name="celebration" className="text-4xl text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">Welcome to Premium!</h1>
            <p className="text-white/60 mb-8 max-w-xs">Your subscription has been activated. Enjoy all the new features!</p>
            <button
                onClick={() => navigate('/')}
                className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all"
            >
                Start Exploring
            </button>
        </div>
    );
};

export default SubscriptionWelcome;
