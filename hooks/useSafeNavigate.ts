import { useNavigate, useLocation } from 'react-router';
import { useCallback, useEffect } from 'react';

// Shared history state across all instances of the hook
let globalHistory: string[] = [];
const MAX_HISTORY = 50;

// Load from sessionStorage on module load if available
if (typeof window !== 'undefined') {
    const saved = sessionStorage.getItem('fc_nav_history_v2');
    if (saved) {
        try {
            globalHistory = JSON.parse(saved);
        } catch (e) {
            console.error("Error parsing history", e);
        }
    }
}

const saveHistory = () => {
    if (typeof window !== 'undefined') {
        sessionStorage.setItem('fc_nav_history_v2', JSON.stringify(globalHistory));
    }
};

/**
 * Custom hook for safe navigation.
 * - Shared history tracking.
 * - Prevents duplicate history entries.
 * - Handles back-navigation intelligently.
 */
export const useSafeNavigate = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Track path changes
    useEffect(() => {
        const currentPath = location.pathname + location.search;
        const lastPath = globalHistory[globalHistory.length - 1];

        if (currentPath !== lastPath) {
            // Check if we are moving back in history
            const secondToLast = globalHistory[globalHistory.length - 2];
            if (currentPath === secondToLast) {
                globalHistory.pop();
            } else {
                globalHistory.push(currentPath);
                if (globalHistory.length > MAX_HISTORY) {
                    globalHistory.shift();
                }
            }
            saveHistory();
        }
    }, [location]);

    const safeNavigate = useCallback((to: string, options?: any) => {
        const targetPathBase = to.split('?')[0];
        const currentPathBase = location.pathname;
        const previousPathBase = globalHistory[globalHistory.length - 2]?.split('?')[0];

        // 1. If target is current path, use replace to avoid duplicates
        if (targetPathBase === currentPathBase) {
            navigate(to, { ...options, replace: true });
            return;
        }

        // 2. Specialized case: If we are going back to the previous page in our history
        // Example: ChatDetail -> ProfilePreview -> ChatDetail (click Message button)
        if (targetPathBase === previousPathBase) {
            navigate(-1);
            return;
        }

        // 3. Prevent duplicate ProfilePreview in history
        if (targetPathBase.includes('/profile/') && currentPathBase.includes('/profile/')) {
            navigate(to, { ...options, replace: true });
            return;
        }

        navigate(to, options);
    }, [navigate, location.pathname]);

    const safeBack = useCallback((fallback: string = '/') => {
        // If we have local app history, go back
        if (globalHistory.length > 1) {
            navigate(-1);
        } else {
            // If no history (e.g. fresh landing), go to fallback
            navigate(fallback, { replace: true });
        }
    }, [navigate]);

    return { 
        safeNavigate, 
        safeBack, 
        navigate, // Direct access if needed
        location 
    };
};
