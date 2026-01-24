import { useEffect } from 'react';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useNavigate, useLocation } from 'react-router';

export const useAppTour = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const startProfileTour = () => {
        const driverObj = driver({
            showProgress: true,
            animate: true,
            popoverClass: 'driverjs-theme',
            nextBtnText: 'Next',
            prevBtnText: 'Back',
            doneBtnText: 'Got it!',
            steps: [
                {
                    element: '#tour-shared-media',
                    popover: {
                        title: 'Shared Media',
                        description: 'This is where your public and private photos live. Public photos are visible to everyone, while private ones are not, unless someone fancies you and spies on you.',
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: '#tour-spy-list',
                    popover: {
                        title: 'Spy List',
                        description: 'See who all you have "spied" on. Curiosity all the way!',
                        side: "top",
                        align: 'center'
                    }
                },
                {
                    element: '#tour-spy-credits',
                    popover: {
                        title: 'Spy Credits',
                        description: 'Use These credits to unlock private media of other users. MAX members get unlimited credits!',
                        side: "top",
                        align: 'center'
                    }
                }
            ],
            onDestroyed: () => {
                // If the user finished the profile tour, take them to Discover
                const currentStep = localStorage.getItem('app_tour_step');
                if (currentStep === 'profile_in_progress') {
                     // If they closed it early, we still might want to mark it or just stop.
                     // The requirement is to navigate to Discover after.
                     localStorage.setItem('app_tour_step', 'discover_pending');
                     navigate('/');
                }
            },
            onCloseClick: () => {
                localStorage.removeItem('app_tour_step');
                driverObj.destroy();
            }
        });

        localStorage.setItem('app_tour_step', 'profile_in_progress');
        driverObj.drive();
    };

    const startDiscoverTour = () => {
        // Find the first card
        const card = document.querySelector('#tour-card-image');
        if (!card) return;

        const driverObj = driver({
            showProgress: true,
            animate: true,
            popoverClass: 'driverjs-theme',
            nextBtnText: 'Next',
            prevBtnText: 'Back',
            doneBtnText: 'Finish',
            steps: [
                {
                    element: '#tour-card-image',
                    popover: {
                        title: 'Discovery Card',
                        description: 'Hold down on the image to view it in full screen. Swipe left or right to see more photos of the user.',
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: '#tour-card-nav',
                    popover: {
                        title: 'Navigation',
                        description: 'Tap on the left or right edges to quickly navigate through the user\'s gallery.',
                        side: "right",
                        align: 'center'
                    }
                },
                {
                    element: '#tour-card-profile',
                    popover: {
                        title: 'View Profile',
                        description: 'Check out the full profile, bio, and interests of this user.',
                        side: "top",
                        align: 'center'
                    }
                },
                {
                    element: '#tour-card-spy',
                    popover: {
                        title: 'Spy & Unlock',
                        description: 'Feeling curious? Click here to unlock this user\'s private vault using your Spy Credits.',
                        side: "top",
                        align: 'center'
                    }
                },
                {
                    element: '#tour-card-connect',
                    popover: {
                        title: 'Connect',
                        description: 'Send a wave and start a conversation. Intimacy starts with a single click.',
                        side: "top",
                        align: 'center'
                    }
                }
            ],
            onDestroyed: () => {
                localStorage.removeItem('app_tour_step');
            },
             onCloseClick: () => {
                localStorage.removeItem('app_tour_step');
                driverObj.destroy();
            }
        });

        localStorage.setItem('app_tour_step', 'discover_in_progress');
        driverObj.drive();
    };

    useEffect(() => {
        const tourStep = localStorage.getItem('app_tour_step');
        
        if (location.pathname === '/profile' && tourStep === 'profile_pending') {
            const timer = setTimeout(startProfileTour, 800);
            return () => clearTimeout(timer);
        }

        if (location.pathname === '/' && tourStep === 'discover_pending') {
            // Check if cards are present
            const checkCards = setInterval(() => {
                if (document.querySelector('#tour-card-image')) {
                    clearInterval(checkCards);
                    startDiscoverTour();
                }
            }, 500);
            
            const timeout = setTimeout(() => clearInterval(checkCards), 5000);
            return () => {
                clearInterval(checkCards);
                clearTimeout(timeout);
            };
        }
    }, [location.pathname]);

    return {
        startTour: () => {
            localStorage.setItem('app_tour_step', 'profile_pending');
            navigate('/profile');
        }
    };
};
