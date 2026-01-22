import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { useNavigate, useLoaderData } from 'react-router';
import Icon from '../components/Icon';
import { motion } from 'framer-motion';

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    const title = data?.title || 'Policy';
    return [
        { title: `FireConnect - ${title}` },
        { name: "description", content: `Read our ${title} to understand your rights and our responsibilities.` },
    ];
};

export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const isPrivacy = url.pathname.includes('privacy');
    const title = isPrivacy ? 'Privacy Policy' : 'Terms & Conditions';
    
    return {
        isPrivacy,
        title,
        lastUpdated: 'January 21, 2026'
    };
}

interface PolicySection {
    title: string;
    content: React.ReactNode;
}

const Policy: React.FC = () => {
    const navigate = useNavigate();
    const loaderData = useLoaderData<typeof loader>();
    const { isPrivacy, title, lastUpdated } = loaderData;

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
        <div className="min-h-screen w-full bg-background-dark font-display antialiased relative overflow-hidden flex flex-col">
            {/* Background Decorations */}
            <div className="absolute top-[10%] -right-20 w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="absolute bottom-[10%] -left-20 w-[600px] h-[600px] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none"></div>

            {/* Header */}
            <header className="sticky top-0 z-50 w-full bg-background-dark/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => navigate(-1)}
                            className="size-12 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-all active:scale-95 group"
                        >
                            <Icon name="arrow_back" className="text-[28px] group-hover:-translate-x-0.5 transition-transform" />
                        </button>
                        <div className="flex flex-col">
                            <h1 className="text-3xl font-black text-white tracking-tight leading-none mb-1">{title}</h1>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] items-center py-0.5 px-2 bg-primary/10 border border-primary/20 text-primary rounded-full font-black uppercase tracking-widest whitespace-nowrap">
                                    Last Updated: {lastUpdated}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-16 relative z-10">
                <div className="bg-surface-dark/40 backdrop-blur-xl rounded-[40px] border border-white/10 p-8 lg:p-14 shadow-2xl relative">
                    <motion.div 
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="flex flex-col gap-16"
                    >
                        {activeSections.map((section, index) => (
                            <section key={index} className="flex flex-col lg:flex-row gap-6 lg:gap-12 group">
                                <div className="lg:w-1/4 shrink-0">
                                    <h2 className="text-primary font-black text-xs uppercase tracking-[0.25em] sticky top-32">
                                        {section.title.split('. ')[0]}
                                    </h2>
                                </div>
                                <div className="flex-1 flex flex-col gap-4">
                                    <h2 className="text-white text-2xl font-black tracking-tight group-hover:text-primary transition-colors duration-300">
                                        {section.title.split('. ')[1] || section.title}
                                    </h2>
                                    <div className="text-white/40 text-[15px] leading-relaxed font-medium group-hover:text-white/60 transition-colors duration-300">
                                        {section.content}
                                    </div>
                                </div>
                            </section>
                        ))}

                        <div className="text-center pt-12 border-t border-white/5 opacity-50">
                            <p className="text-[11px] text-white/30 font-black uppercase tracking-[0.4em] mb-4">FireConnect Legal • {new Date().getFullYear()}</p>
                            <div className="flex items-center justify-center gap-6">
                                <div className="size-1.5 rounded-full bg-primary/20"></div>
                                <div className="size-2 rounded-full bg-primary/40"></div>
                                <div className="size-1.5 rounded-full bg-primary/20"></div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </main>

            {/* Bottom Decor */}
            <div className="h-20 shrink-0"></div>
        </div>
    );
};

export default Policy;
