import React from 'react';
import Icon from '../components/Icon';

const Subscription: React.FC = () => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <Icon name="workspace_premium" className="text-6xl text-primary/20 mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Subscription</h1>
            <p className="text-white/50 max-w-xs">Unlock premium features and see more! Coming soon!</p>
        </div>
    );
};

export default Subscription;
