import { useQuery } from '@tanstack/react-query';
import { resolveImageUrl } from '../lib/image-resolver';
import { supabase } from '../lib/supabase.client';

/**
 * A hook that resolves a storage path to a URL.
 * Handles the async nature of local development resolution and signed URLs for private media.
 * 
 * @param path The storage path or URL.
 * @returns { url: string, loading: boolean }
 */
export function useResolvedImage(path: string | undefined | null) {
    const { data: url, isLoading } = useQuery({
        queryKey: ['resolved-image', path],
        queryFn: async () => {
            if (!path) return undefined;

            // Fast path for absolute URLs and local blobs
            if (path.startsWith('http') || path.startsWith('blob:')) {
                return path;
            }

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
                return data.signedUrl;
            } else {
                return resolveImageUrl(path);
            }
        },
        enabled: !!path,
        staleTime: Infinity, // Or a large number. Manual invalidation on reveal will override this.
    });

    return { 
        url, 
        loading: !!path && isLoading 
    };
}
