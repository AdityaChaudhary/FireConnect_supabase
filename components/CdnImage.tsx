import React from 'react';
import { useResolvedImage } from '../hooks/useResolvedImage';

interface CdnImageProps {
    path: string | undefined | null;
    alt?: string;
    className?: string;
    style?: React.CSSProperties;
    useAsBackground?: boolean;
    children?: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    placeholder?: string;
}

/**
 * A component that renders an image from Supabase Storage/CDN.
 * Automatically handles development vs production URL resolution.
 * Supports both <img> tags and background images on a <div>.
 */
const CdnImage: React.FC<CdnImageProps> = ({
    path,
    alt = '',
    className = '',
    style = {},
    useAsBackground = false,
    children,
    onClick,
    placeholder
}) => {
    const { url, loading } = useResolvedImage(path);

    // If we have a placeholder and no URL yet (including loading state), use it
    const displayUrl = url || placeholder || undefined;

    if (useAsBackground) {
        return (
            <div
                className={className}
                style={{
                    ...style,
                    backgroundImage: displayUrl ? `url("${displayUrl}")` : 'none',
                }}
                onClick={onClick}
            >
                {/* We don't want to hide children while loading if we have a background image */}
                {children}
            </div>
        );
    }

    if (!displayUrl) return null;

    return (
        <img
            src={displayUrl}
            alt={alt}
            crossOrigin="anonymous"
            className={`${className} ${loading && !url ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}`}
            style={style}
            onClick={onClick}
        />
    );
};

export default CdnImage;
