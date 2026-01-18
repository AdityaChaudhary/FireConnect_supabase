import { useState, useEffect } from 'react';
import { resolveImageUrl } from '../lib/image-resolver';
import { supabase } from '../lib/supabase';

/**
 * A hook that resolves a storage path to a URL.
 * Handles the async nature of local development resolution and signed URLs for private media.
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

        // Fast path for absolute URLs and local blobs
        if (path.startsWith('http') || path.startsWith('blob:')) {
            setUrl(path);
            setLoading(false);
            return;
        }

        const resolve = async () => {
            try {
                // If it's private, we need a signed URL
                const isPrivate = path.includes('/PRIVATE/') || path.includes('private-media/');
                
                if (isPrivate) {
                    const cleanPath = path
                        .replace(/^(private-media)\//, '')
                        .replace(/^\//, ''); // Remove leading slash if any

                    const { data, error } = await supabase.storage
                        .from('private-media')
                        .createSignedUrl(cleanPath, 3600); // 1 hour expiry

                    if (error) throw error;
                    if (isMounted) {
                        setUrl(data.signedUrl);
                        setLoading(false);
                    }
                } else {
                    const resolvedUrl = resolveImageUrl(path);
                    if (isMounted) {
                        setUrl(resolvedUrl);
                        setLoading(false);
                    }
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
