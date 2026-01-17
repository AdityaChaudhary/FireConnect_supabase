import { useState, useEffect } from 'react';
import { resolveImageUrl } from '../lib/image-resolver';

/**
 * A hook that resolves a storage path to a URL.
 * Handles the async nature of local development resolution.
 * 
 * @param path The storage path or URL.
 * @returns { url: string, loading: boolean }
 */
export function useResolvedImage(path: string | undefined | null) {
    const [url, setUrl] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(!!path);

    useEffect(() => {
        if (!path) {
            setUrl(undefined);
            setLoading(false);
            return;
        }

        let isMounted = true;
        setLoading(true);

        const resolve = async () => {
            try {
                const resolvedUrl = resolveImageUrl(path);

                if (isMounted) {
                    setUrl(resolvedUrl);
                    setLoading(false);
                }
            } catch (error) {
                console.error('Error resolving image:', error);
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        resolve();

        return () => {
            isMounted = false;
        };
    }, [path]);

    return { url, loading };
}
