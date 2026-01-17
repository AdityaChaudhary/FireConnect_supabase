import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';

const PurchaseCredits: React.FC = () => {
    const navigate = useNavigate();
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <Icon name="monetization_on" className="text-6xl text-primary/20 mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Get Spy Credits</h1>
            <p className="text-white/50 mb-8 max-w-xs">Purchase credits to unlock private media and more.</p>
            <button
                onClick={() => navigate(-1)}
                className="text-white/40 hover:text-white underline text-sm"
            >
                Go Back
            </button>
        </div>
    );
};

export default PurchaseCredits;
