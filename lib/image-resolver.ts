export const resolveImageUrl = (path: string | undefined): string => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('blob:')) return path;

    // Supabase Storage URL
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    
    // Check if path indicates private media
    // Our paths in DB might look like:
    // 1. users/uid/shared/PRIVATE/image.jpg
    // 2. private-media/users/uid/...
    const isPrivate = path.includes('/PRIVATE/') || path.includes('private-media/');
    
    const bucket = isPrivate ? 'private-media' : 'public-media';
    // For local dev and some public configs, 'public' type is safer for public-media
    const type = isPrivate ? 'authenticated' : 'public';
    
    // Clean path: remove bucket names if they exist at the start, and handle potential double slashes
    const cleanPath = path
        .replace(/^(public-media|private-media|profile-images)\//, '')
        .replace(/^\//, ''); // Remove leading slash if any
    
    return `${supabaseUrl}/storage/v1/object/${type}/${bucket}/${cleanPath}`;
};
