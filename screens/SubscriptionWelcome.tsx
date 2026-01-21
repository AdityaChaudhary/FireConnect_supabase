import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router';
import Icon from '../components/Icon';
import { PLAN_THEMES, PLAN_FEATURES, PLAN_DESCRIPTIONS } from '../config/plans';
import confetti from 'canvas-confetti';

const SubscriptionWelcome: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isExiting, setIsExiting] = React.useState(false);

    const queryParams = new URLSearchParams(location.search);
    const planId = (queryParams.get('plan') || 'PRO').toUpperCase();

    const theme = PLAN_THEMES[planId] || PLAN_THEMES.PRO;
    const features = PLAN_FEATURES[planId] || PLAN_FEATURES.PRO;
    const description = PLAN_DESCRIPTIONS[planId] || PLAN_DESCRIPTIONS.PRO;

    useEffect(() => {
        // Continuous fireworks/confetti for 10 seconds
        const duration = 10 * 500;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval = setInterval(() => {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);

            // Burst from left side
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
            });
            // Burst from right side
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
            colors: ['#ffc000', '#ff0000', '#ff0080', '#8000ff', '#0080ff']
        });

        return () => clearInterval(interval);
    }, []);

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

    const itemVariants: any = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { type: 'spring', stiffness: 100 }
        }
    };

    const badgeVariants: any = {
        hidden: { scale: 0, rotate: -10 },
        visible: {
            scale: 1,
            rotate: 0,
            transition: {
                type: 'spring',
                damping: 12,
                stiffness: 200,
                delay: 0.1
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
        <div className="fixed inset-0 z-50 flex flex-col bg-background-dark text-white overflow-y-auto custom-scrollbar">
            {/* Background Glows */}
            <div className={`fixed top-[-10%] left-[-10%] w-[60%] h-[40%] rounded-full blur-[100px] opacity-20 pointer-events-none ${planId === 'MAX' ? 'bg-purple-600' : 'bg-primary'}`}></div>
            <div className={`fixed bottom-[-10%] right-[-10%] w-[60%] h-[40%] rounded-full blur-[100px] opacity-10 pointer-events-none ${planId === 'MAX' ? 'bg-primary' : 'bg-blue-600'}`}></div>

            {/* Exit Reveal Overlay */}
            <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={isExiting ? { scale: 4, opacity: 1 } : { scale: 0, opacity: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className={`fixed inset-0 z-[60] rounded-full pointer-events-none ${planId === 'MAX' ? 'bg-purple-600' : 'bg-primary'}`}
                style={{ originX: 0.5, originY: 0.8 }} // Expands from button area
            />

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate={isExiting ? { opacity: 0, scale: 0.9, filter: 'blur(10px)' } : "visible"}
                className="relative z-10 flex w-full max-w-md flex-1 flex-col items-center pt-8 pb-32 px-6 mx-auto"
            >
                {/* Celebration Icon/Badge */}
                <motion.div
                    variants={badgeVariants}
                    className={`flex h-20 w-20 items-center justify-center rounded-2xl border-2 shadow-2xl ${theme.theme} ${theme.accent.replace('text-', 'border-')}`}
                >
                    <Icon name="local_fire_department" className={`text-4xl ${theme.accent}`} filled />
                </motion.div>

                <motion.div variants={itemVariants} className="mt-6 text-center">
                    <h2 className="text-[10px] font-bold tracking-[0.3em] opacity-60 uppercase">{description}</h2>

                    <div className="mt-6 flex flex-row flex-wrap items-center justify-center gap-x-4 gap-y-2">
                        <h1 className="text-4xl font-black italic tracking-tighter uppercase leading-none">
                            You're
                        </h1>

                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.5, type: 'spring' }}
                            className={`flex items-center gap-3 rounded-full px-6 py-3 border shadow-2xl ${planId === 'MAX'
                                ? 'bg-gradient-to-r from-purple-600 to-primary border-transparent text-white shadow-primary/20'
                                : planId === 'PRO'
                                    ? 'bg-primary/20 border-primary text-primary font-bold'
                                    : 'bg-surface-dark border-white/10 text-white/80'
                                }`}
                        >
                            <Icon
                                name={planId === 'MAX' ? "workspace_premium" : planId === 'PRO' ? "stars" : "bolt"}
                                className={`text-[24px] ${planId === 'MAX' ? 'text-white' : 'text-primary'}`}
                                filled
                            />
                            <span className="text-xl font-black uppercase tracking-wider">
                                {planId === 'MAX' ? 'MAX' : planId === 'PRO' ? 'PRO' : 'LITE'}
                            </span>
                        </motion.div>
                    </div>

                    <p className="mt-6 text-sm text-white/50 px-8 leading-relaxed">
                        Get ready for a premium experience!
                    </p>
                </motion.div>

                {/* Features List */}
                <motion.div variants={itemVariants} className="mt-10 w-full space-y-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2 pl-2">New Perks Unlocked</h3>
                    {features.filter(f => f.included).map((feature, idx) => (
                        <motion.div
                            key={idx}
                            variants={itemVariants}
                            className="flex items-center gap-4 rounded-xl bg-white/5 p-4 border border-white/5 backdrop-blur-sm"
                        >
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 ${theme.accent}`}>
                                <Icon name="check" className="text-base" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold">{feature.text}</span>
                                {feature.subtext && <span className="text-[11px] text-white/40 leading-tight mt-0.5">{feature.subtext}</span>}
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </motion.div>

            {/* Action Button - Floating at bottom */}
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, type: 'spring' }}
                className="fixed bottom-0 left-0 right-0 z-20 w-full p-6 pb-12 bg-gradient-to-t from-background-dark via-background-dark to-transparent"
            >
                <div className="max-w-md mx-auto w-full">
                    <button
                        onClick={handleExit}
                        className={`group relative h-16 w-full overflow-hidden rounded-2xl font-black text-lg uppercase tracking-tight transition-all active:scale-95 shadow-2xl ${theme.buttonTheme}`}
                    >
                        <span className="relative z-10 block">Let's Go</span>
                        <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100"></div>
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default SubscriptionWelcome;

