import { useState, useCallback, useRef } from 'react';

interface IntersectionObserverOptions extends IntersectionObserverInit {
    triggerOnce?: boolean;
    onIntersect?: () => void;
}

export const useIntersectionObserver = (options: IntersectionObserverOptions = {}) => {
    const { triggerOnce = false, onIntersect, ...observerOptions } = options;
    const [hasBeenInView, setHasBeenInView] = useState(false);
    const [isIntersecting, setIsIntersecting] = useState(false);
    
    // Store observer in ref to persist across renders
    const observer = useRef<IntersectionObserver | null>(null);

    const targetRef = useCallback((node: HTMLElement | null) => {
        // Disconnect existing observer if any
        if (observer.current) {
            observer.current.disconnect();
        }

        if (node) {
            observer.current = new IntersectionObserver(([entry]) => {
                const isViewing = entry.isIntersecting;
                setIsIntersecting(isViewing);
                
                if (isViewing) {
                    setHasBeenInView(true);
                    onIntersect?.();
                    if (triggerOnce) {
                        observer.current?.unobserve(node);
                    }
                }
            }, observerOptions);

            observer.current.observe(node);
        }
    }, [observerOptions.root, observerOptions.rootMargin, observerOptions.threshold, triggerOnce, onIntersect]);

    return { targetRef, hasBeenInView, isIntersecting };
};
