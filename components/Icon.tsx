import React from 'react';
import * as LucideIcons from 'lucide-react';

interface IconProps {
    name: string;
    className?: string;
    filled?: boolean;
    type?: 'material' | 'lucide';
    size?: number | string;
}

const Icon: React.FC<IconProps> = ({ name, className = "", filled = false, type = 'material', size }) => {
    if (type === 'lucide') {
        const LucideIcon = (LucideIcons as any)[name];
        if (LucideIcon) {
            return <LucideIcon className={className} size={size} />;
        }
    }

    return (
        <span
            className={`material-symbols-outlined select-none ${filled ? 'filled' : ''} ${className}`}
            style={size ? { fontSize: typeof size === 'number' ? `${size}px` : size } : {}}
        >
            {name}
        </span>
    );
};

export default Icon;
