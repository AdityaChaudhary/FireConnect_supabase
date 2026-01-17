export const STORAGE_PATHS = {
    avatars: (userId: string, timestamp: number) => `users/${userId}/avatars/${timestamp}`,
    sharedMedia: (userId: string, visibility: string, timestamp: number, fileName?: string) =>
        `users/${userId}/shared/${visibility}/${timestamp}`
};

export const DEFAULT_LOGIN_REDIRECT = '/profile';

export const AVAILABLE_INTERESTS = [
    "Dating", "Intimacy", "Sexting", "Romance", "Flirting", "Casual Dating",
    "BDSM", "Kink", "Fetish", "Roleplay", "Threesomes", "Polyamory",
    "Open Relationships", "Tantra", "Hookups", "NSA", "FWB", "Bondage",
    "Domination", "Submission"
];
