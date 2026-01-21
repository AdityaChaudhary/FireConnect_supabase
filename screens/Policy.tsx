import React from 'react';
import { useNavigate, useLocation } from 'react-router';
import Icon from '../components/Icon';
import { motion } from 'framer-motion';

interface PolicySection {
    title: string;
    content: React.ReactNode;
}

const Policy: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const isPrivacy = location.pathname.includes('privacy');
    
    const title = isPrivacy ? 'Privacy Policy' : 'Terms & Conditions';
    const lastUpdated = 'January 21, 2026';

    const privacySections: PolicySection[] = [
        {
            title: "1. Introduction",
            content: "At FireConnect, your privacy is our top priority. This Privacy Policy explains how we collect, use, and protect your information when you use our dating and social networking services. By using FireConnect, you agree to the practices described in this policy."
        },
        {
            title: "2. Information We Collect",
            content: (
                <div className="flex flex-col gap-3">
                    <p>We collect information to provide a better experience and connect you with others:</p>
                    <ul className="list-disc pl-5 flex flex-col gap-2">
                        <li><span className="font-bold text-white/90">Profile Data:</span> Name, age, gender, location, interests, and photos you upload.</li>
                        <li><span className="font-bold text-white/90">Chat Data:</span> Messages and media exchanged with other users to facilitate your connections.</li>
                        <li><span className="font-bold text-white/90">Technical Data:</span> IP address, device type, operating system, and app usage patterns.</li>
                        <li><span className="font-bold text-white/90">Location Data:</span> We use your location to show you nearby matches, with your permission.</li>
                    </ul>
                </div>
            )
        },
        {
            title: "3. How We Use Your Information",
            content: (
                <ul className="list-disc pl-5 flex flex-col gap-2">
                    <li>To create and manage your account.</li>
                    <li>To provide our matching algorithm and connect you with compatible users.</li>
                    <li>To improve our features and develop new functionalities.</li>
                    <li>To ensure the safety and security of our community by detecting and preventing fraud or harassment.</li>
                    <li>To process payments and manage your subscriptions.</li>
                </ul>
            )
        },
        {
            title: "4. Data Sharing and Disclosure",
            content: "We do not sell your personal data. We only share information with service providers who help us operate FireConnect (e.g., hosting, payment processing) or when required by law to protect our rights or the safety of others."
        },
        {
            title: "5. Data Security",
            content: "We implement industry-standard security measures, including encryption and secure servers, to protect your data from unauthorized access or disclosure. However, no internet transmission is 100% secure, so we cannot guarantee absolute security."
        },
        {
            title: "6. Your Rights",
            content: "You have the right to access, update, or delete your personal information at any time through the app settings. You can also withdraw your consent for location tracking or data collection by contacting our support team."
        },
        {
            title: "7. Cookie Policy",
            content: "We use cookies and similar technologies to remember your preferences and enhance your user experience. You can manage cookie settings through your device or browser."
        }
    ];

    const termsSections: PolicySection[] = [
        {
            title: "1. Acceptance of Terms",
            content: "By creating a FireConnect account, you agree to these Terms & Conditions. If you do not agree, you may not use our services."
        },
        {
            title: "2. Eligibility",
            content: "You must be at least 18 years old to use FireConnect. By using the app, you represent that you meet this age requirement and have the legal capacity to enter into this agreement."
        },
        {
            title: "3. Account Security",
            content: "You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. Notify us immediately if you suspect unauthorized access."
        },
        {
            title: "4. Prohibited Conduct",
            content: (
                <div className="flex flex-col gap-3">
                    <p>To keep FireConnect safe, you agree NOT to:</p>
                    <ul className="list-disc pl-5 flex flex-col gap-2">
                        <li>Harass, bully, or intimidate other users.</li>
                        <li>Post sexually explicit, violent, or illegal content.</li>
                        <li>Use the app for commercial purposes, spam, or scams.</li>
                        <li>Create multiple accounts or impersonate others.</li>
                        <li>Attempt to hack or disrupt the app's functionality.</li>
                    </ul>
                </div>
            )
        },
        {
            title: "5. User Content",
            content: "You retain ownership of the content you post on FireConnect. However, you grant us a worldwide, royalty-free license to use, display, and distribute your content for the purpose of providing and promoting our services."
        },
        {
            title: "6. Subscriptions and Payments",
            content: "Premium features require a subscription. Payments are processed via Stripe. Subscriptions automatically renew unless canceled at least 24 hours before the end of the current period. Refunds are subject to our refund policy."
        },
        {
            title: "7. Limitation of Liability",
            content: "FireConnect is provided 'as is'. We are not liable for any indirect, incidental, or consequential damages arising from your use of the app or interactions with other users."
        },
        {
            title: "8. Termination",
            content: "We reserve the right to suspend or terminate your account at our discretion, without notice, if you violate these Terms or engage in conduct that harms our community."
        }
    ];

    const activeSections = isPrivacy ? privacySections : termsSections;

    return (
        <div className="flex min-h-screen w-full flex-col bg-background-dark text-white pb-12">
            {/* Header */}
            <header className="sticky top-0 z-20 flex w-full items-center gap-4 bg-background-dark/80 px-4 py-3 backdrop-blur-md border-b border-white/5">
                <button
                    onClick={() => navigate(-1)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-dark text-white hover:bg-white/10 active:scale-95 transition-all"
                >
                    <Icon name="arrow_back" />
                </button>
                <div className="flex flex-col">
                    <span className="text-lg font-bold tracking-tight">{title}</span>
                    <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Last Updated: {lastUpdated}</span>
                </div>
            </header>

            <main className="flex-1 px-5 pt-8 max-w-2xl mx-auto w-full">
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-10"
                >
                    {activeSections.map((section, index) => (
                        <section key={index} className="flex flex-col gap-3 group">
                            <h2 className="text-primary font-bold text-lg tracking-tight flex items-center gap-2">
                                <div className="h-1 w-1 rounded-full bg-primary/40 group-hover:scale-150 transition-transform"></div>
                                {section.title}
                            </h2>
                            <div className="text-white/70 text-sm leading-relaxed font-medium">
                                {section.content}
                            </div>
                        </section>
                    ))}

                    <div className="text-center pb-8 mt-12 border-t border-white/5 pt-8">
                        <p className="text-[10px] text-white/20 font-bold uppercase tracking-[0.2em]">FireConnect Legal • {new Date().getFullYear()}</p>
                    </div>
                </motion.div>
            </main>
        </div>
    );
};

export default Policy;
