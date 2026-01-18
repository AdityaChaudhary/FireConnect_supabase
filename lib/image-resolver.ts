export const resolveImageUrl = (path: string | undefined): string => {
    if (!path) return '';
    if (path.startsWith('http')) return path;

    // Supabase Storage URL
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    
    // Check if path indicates private media or is explicitly defined
    const isPrivate = path.includes('/PRIVATE/') || path.includes('private-media/');
    // If the path already has the bucket name, we should handle it, but usually it's just the relative path.
    // According to our plan:
    // public-media contains PUBLIC files and avatar files
    // private-media contains PRIVATE files
    
    const bucket = isPrivate ? 'private-media' : 'public-media';
    const type = isPrivate ? 'authenticated' : 'public';
    
    // Strip bucket name from path if it was accidentally included at the start
    const cleanPath = path.replace(/^(public-media |private-media |profile-images)\//, '');
    
    return `${supabaseUrl}/storage/v1/object/${type}/${bucket}/${cleanPath}`;
};
