import React, { useEffect, useState } from 'react';
import { useNavigation } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';

const NavigationProgress: React.FC = () => {
    const navigation = useNavigation();
    const [isVisible, setIsVisible] = useState(false);
    
    // Smoothly handle the visibility to avoid flickering for fast loads
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (navigation.state === 'loading') {
            timeout = setTimeout(() => setIsVisible(true), 100);
        } else {
            setIsVisible(false);
        }
        return () => clearTimeout(timeout);
    }, [navigation.state]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none h-1"
                >
                    <motion.div
                        className="h-full bg-gradient-to-r from-fire-pink via-primary to-neon-purple shadow-[0_0_8px_rgba(255,0,85,0.5)]"
                        initial={{ width: "0%" }}
                        animate={{ 
                            width: ["0%", "30%", "70%", "90%"],
                            transition: { 
                                duration: 15, 
                                ease: "linear",
                                times: [0, 0.1, 0.4, 1]
                            }
                        }}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default NavigationProgress;
