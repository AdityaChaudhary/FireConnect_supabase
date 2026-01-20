import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        // If we are not going to the discover page, scroll to top
        // The discover page handles its own scroll restoration
        if (pathname !== '/discover') {
            window.scrollTo(0, 0);
        }
    }, [pathname]);

    return null;
};

export default ScrollToTop;
