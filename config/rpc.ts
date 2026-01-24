import type { Database } from '../lib/database.types';

export type UserProfile = Database['public']['Tables']['users']['Row'] & {
    user_online_status: Database['public']['Tables']['user_online_status']['Row'][];
};

export type ConnectionWithUser = Database['public']['Tables']['connections']['Row'] & {
    requester: UserProfile;
    recipient: UserProfile;
};

export type ThreadWithDetails = Database['public']['Tables']['threads']['Row'];

export interface ChatViewData {
    connections: ConnectionWithUser[];
    threads: ThreadWithDetails[];
    participants: Record<string, UserProfile>;
}

export type ProfileImage = Database['public']['Tables']['profile_images']['Row'];

export interface ProfileViewData {
    images: ProfileImage[];
    spy_count: number;
}

// Assuming the shape of products from get_active_plans matches StripeProduct interface roughly
// We'll define a basic shape or import it if better
export interface LandingPageData {
    products: any[]; // We'll cast this to StripeProduct[] in usage
    ai_users: UserProfile[];
}
