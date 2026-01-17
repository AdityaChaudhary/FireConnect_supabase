export interface PlanFeature {
    text: string;
    included: boolean;
    subtext?: string;
}

export interface PlanTheme {
    theme: string;
    buttonTheme: string;
    accent: string;
}

export interface PlanConfig {
    id: string;
    name: string;
    description: string;
    features: PlanFeature[];
    theme: PlanTheme;
}

export const PLAN_THEMES: Record<string, PlanTheme> = {
    FREE: {
        theme: 'bg-surface-dark border-white/5',
        buttonTheme: 'bg-white/10 text-white',
        accent: 'text-white/40'
    },
    PRO: {
        theme: 'bg-gradient-to-br from-primary/20 to-surface-dark border-primary/30',
        buttonTheme: 'bg-primary text-white shadow-lg shadow-primary/25',
        accent: 'text-primary'
    },
    MAX: {
        theme: 'bg-gradient-to-br from-purple-900/40 via-surface-dark to-primary/20 border-purple-500/30',
        buttonTheme: 'bg-gradient-to-r from-primary to-purple-600 text-white shadow-lg shadow-primary/25',
        accent: 'text-purple-400'
    }
};

export const PLAN_DESCRIPTIONS: Record<string, string> = {
    FREE: 'PERFORMS LIKE A PRO',
    PRO: 'UPGRADE YOUR EXPERIENCE',
    MAX: 'THE ULTIMATE CONNECT'
};

export const PLAN_FEATURES: Record<string, PlanFeature[]> = {
    FREE: [
        { text: 'Unlimited Likes', included: true, subtext: 'Swipe right as much as you want.' },
        { text: 'Unlimited Messages', included: true, subtext: 'Connect with anyone you match.' },
        { text: 'Shuffle Chat Filters', included: false, subtext: 'No filters on shuffle chat.' },
    ],
    PRO: [
        { text: 'All Perks of Lite', included: true },
        { text: 'Spy Credits', included: true, subtext: 'To spy on private photos.' },
        { text: 'Shuffle Chat Filters', included: true, subtext: 'Target your random chats.' },
        { text: 'Share Private Photos', included: true, subtext: 'In your private conversations.' },
    ],
    MAX: [
        { text: 'All Perks of Pro', included: true },
        { text: 'Unlimited Spy Credits', included: true, subtext: 'See everything.' },
        { text: 'Message Anyone', included: true, subtext: 'Without needing a connection.' },
        { text: 'Share Videos in Chat', included: true, subtext: 'Coming soon!' },
    ]
};

export const PLANS: PlanConfig[] = [
    {
        id: 'FREE',
        name: 'LITE',
        description: PLAN_DESCRIPTIONS.FREE,
        features: PLAN_FEATURES.FREE,
        theme: PLAN_THEMES.FREE
    },
    {
        id: 'PRO',
        name: 'PRO',
        description: PLAN_DESCRIPTIONS.PRO,
        features: PLAN_FEATURES.PRO,
        theme: PLAN_THEMES.PRO
    },
    {
        id: 'MAX',
        name: 'MAX',
        description: PLAN_DESCRIPTIONS.MAX,
        features: PLAN_FEATURES.MAX,
        theme: PLAN_THEMES.MAX
    }
];
