import { useState, useEffect, useRef } from 'react';

interface IntersectionObserverOptions {
    root?: Element | null;
    rootMargin?: string;
    threshold?: number | number[];
}

export const useIntersectionObserver = (options: IntersectionObserverOptions = {}) => {
    const [hasBeenInView, setHasBeenInView] = useState(false);
    const targetRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setHasBeenInView(true);
                if (targetRef.current) {
                    observer.unobserve(targetRef.current);
                }
            }
        }, options);

        const currentTarget = targetRef.current;
        if (currentTarget) {
            observer.observe(currentTarget);
        }

        return () => {
            if (currentTarget) {
                observer.unobserve(currentTarget);
            }
        };
    }, [options.root, options.rootMargin, options.threshold]);

    return { targetRef, hasBeenInView };
};
