export const resolveImageUrl = (path: string | undefined): string => {
    if (!path) return '';
    if (path.startsWith('http')) return path;

    // Supabase Storage URL
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/storage/v1/object/public/profile-images/${path}`;
};
