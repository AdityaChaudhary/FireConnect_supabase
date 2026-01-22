import React, { useState } from 'react';
import { useResolvedImage } from '../hooks/useResolvedImage';
import { getDefaultAvatar } from '../lib/image-utils';

interface CdnImageProps {
    path: string | undefined | null;
    alt?: string;
    className?: string;
    style?: React.CSSProperties;
    useAsBackground?: boolean;
    children?: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    placeholder?: string;
    gender?: string | null;
    seed?: string;
    showSpinner?: boolean;
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
    placeholder,
    gender,
    seed,
    showSpinner = false
}) => {
    const { url, loading } = useResolvedImage(path);

    const [error, setError] = useState(false);

    // Reset error state when path changes
    React.useEffect(() => {
        setError(false);
    }, [path]);

    // If we have a placeholder and no URL yet (including loading state), use it
    // If no path and no placeholder, use Dicebear fallback
    const fallbackUrl = placeholder || getDefaultAvatar(gender, seed);
    const displayUrl = error ? fallbackUrl : (url || (!loading ? fallbackUrl : undefined));

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
                {loading && showSpinner && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[2px]">
                        <div className="size-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    </div>
                )}
                {/* We don't want to hide children while loading if we have a background image */}
                {children}
            </div>
        );
    }

    if (!displayUrl && loading) {
        if (showSpinner) {
            return (
                <div className={`${className} flex items-center justify-center bg-surface-dark`}>
                    <div className="size-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                </div>
            )
        }
        return null;
    }

    return (
        <div className="relative h-full w-full">
            <img
                src={displayUrl || placeholder}
                alt={alt}
                crossOrigin="anonymous"
                className={`${className} ${loading && !url ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}`}
                style={style}
                onClick={onClick}
                onError={() => setError(true)}
            />
            {loading && showSpinner && url && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[2px]">
                    <div className="size-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                </div>
            )}
        </div>
    );
};

export default CdnImage;
