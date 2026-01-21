import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, animate } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router';
import Icon from '../components/Icon';
import confetti from 'canvas-confetti';

const CreditsWelcome: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isExiting, setIsExiting] = useState(false);

    const queryParams = new URLSearchParams(location.search);
    const creditsPurchased = parseInt(queryParams.get('credits') || '0', 10);
    const oldBalance = parseInt(queryParams.get('oldBalance') || '0', 10);
    const newBalance = oldBalance + creditsPurchased;

    // Counter animation setup
    const [count, setCount] = useState(oldBalance);

    useEffect(() => {
        // Start counter animation after a short delay
        const controls = animate(oldBalance, newBalance, {
            duration: 3.5,
            delay: 0.5,
            ease: "easeOut",
            onUpdate(value) {
                setCount(Math.floor(value));
            }
        });

        // Continuous fireworks/confetti
        const duration = 5 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval = setInterval(() => {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);

            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
            });
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
            });
        }, 250);

        // Initial major center burst
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            zIndex: 100,
            colors: ['#3b82f6', '#8b5cf6', '#d946ef'] // Blue, Purple, Pink
        });

        return () => {
            controls.stop();
            clearInterval(interval);
        };
    }, [oldBalance, newBalance]);

    // Animation variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.15,
                delayChildren: 0.3
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { type: 'spring' as const, stiffness: 100 }
        }
    };

    const counterVariants = {
        hidden: { scale: 0.8, opacity: 0 },
        visible: {
            scale: 1,
            opacity: 1,
            transition: {
                type: 'spring' as const,
                damping: 12,
                stiffness: 200,
                delay: 0.2
            }
        }
    };

    const handleExit = () => {
        setIsExiting(true);
        setTimeout(() => {
            navigate('/');
        }, 800);
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-background-dark text-white overflow-hidden">
            {/* Background Glows */}
            <div className="fixed top-[-10%] left-[-10%] w-[60%] h-[40%] rounded-full blur-[100px] opacity-20 pointer-events-none bg-primary"></div>
            <div className="fixed bottom-[-10%] right-[-10%] w-[60%] h-[40%] rounded-full blur-[100px] opacity-10 pointer-events-none bg-purple-600"></div>

            {/* Exit Reveal Overlay */}
            <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={isExiting ? { scale: 4, opacity: 1 } : { scale: 0, opacity: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-0 z-[60] bg-primary rounded-full pointer-events-none"
                style={{ originX: 0.5, originY: 0.8 }}
            />

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate={isExiting ? { opacity: 0, scale: 0.9, filter: 'blur(10px)' } : "visible"}
                className="relative z-10 flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 mx-auto"
            >
                {/* Icon */}
                <motion.div
                    variants={counterVariants}
                    className="flex h-24 w-24 items-center justify-center rounded-[32px] bg-gradient-to-br from-primary to-purple-600 shadow-2xl shadow-primary/20 mb-8"
                >
                    <Icon name="bolt" className="text-5xl text-white" filled />
                </motion.div>

                <motion.div variants={itemVariants} className="text-center">
                    <h2 className="text-[10px] font-bold tracking-[0.3em] opacity-60 uppercase mb-2">Purchase Successful</h2>
                    <h1 className="text-4xl font-black italic tracking-tighter uppercase leading-tight mb-2">
                        Boom! Credits Added
                    </h1>
                    <p className="text-sm text-white/50 px-8 leading-relaxed mb-12">
                        Your arsenal has been upgraded. Ready to reveal some secrets?
                    </p>
                </motion.div>

                {/* Counter Section */}
                <motion.div
                    variants={counterVariants}
                    className="relative flex flex-col items-center"
                >
                    <div className="absolute -inset-8 bg-primary/10 blur-3xl rounded-full pointer-events-none"></div>

                    <div className="flex flex-col items-center z-10">
                        <span className="text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 px-4">
                            {count}
                        </span>
                        <div className="mt-2 flex items-center gap-2 px-6 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Total Spy Credits</span>
                        </div>
                    </div>

                    {/* Simple addition indicator */}
                    <AnimatePresence>
                        {count < newBalance && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="absolute -top-10 right-[-20px] text-2xl font-black text-primary italic"
                            >
                                +{creditsPurchased}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </motion.div>

            {/* Action Button */}
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, type: 'spring' }}
                className="fixed bottom-0 left-0 right-0 z-20 w-full p-6 pb-12 bg-gradient-to-t from-background-dark via-background-dark to-transparent"
            >
                <div className="max-w-md mx-auto w-full">
                    <button
                        onClick={handleExit}
                        className="group relative h-16 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-purple-600 font-black text-lg uppercase tracking-tight transition-all active:scale-95 shadow-2xl shadow-primary/25"
                    >
                        <span className="relative z-10 block">Continue Spying</span>
                        <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100"></div>
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default CreditsWelcome;
