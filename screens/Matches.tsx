import React from 'react';
import Icon from '../components/Icon';

const Matches: React.FC = () => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <Icon name="favorite" className="text-6xl text-primary/20 mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Your Matches</h1>
            <p className="text-white/50 max-w-xs">See who you've connected with. Coming soon!</p>
        </div>
    );
};

export default Matches;
