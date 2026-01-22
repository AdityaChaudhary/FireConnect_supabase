import { Link, type MetaFunction } from 'react-router';
import { BLOG_POSTS } from '../lib/blog-data';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { useLoaderData } from 'react-router';

export const meta: MetaFunction = ({ params }) => {
    const post = BLOG_POSTS[params.title as string];
    if (!post) return [{ title: "Blog Post Not Found | FireConnect" }];

    return [
        { title: post.metaTitle },
        { name: "description", content: post.metaDescription },
        { property: "og:title", content: post.metaTitle },
        { property: "og:description", content: post.metaDescription },
        { property: "og:type", content: "article" },
    ];
};

export async function loader({ params, request }: { params: { title: string }, request: Request }) {
    const post = BLOG_POSTS[params.title as string] || null;
    const url = new URL(request.url);
    const basePath = url.pathname.startsWith('/compare') ? '/compare' : '/blog';
    return { post, basePath };
}

const BlogDetail: React.FC = () => {
    const { post, basePath } = useLoaderData<typeof loader>();

    if (!post) {
        return (
            <div className="min-h-screen bg-background-dark text-white flex flex-col items-center justify-center p-6">
                <h1 className="text-4xl font-bold mb-4">Post Not Found</h1>
                <Link to={basePath} className="text-fire-pink hover:underline uppercase tracking-widest font-bold">Back to {basePath === '/compare' ? 'Comparison' : 'Blog'}</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background-dark text-white font-sans selection:bg-fire-pink selection:text-white pb-32">
            {/* Simple Breadcrumb & Back */}
            <div className="max-w-4xl mx-auto px-6 pt-32 mb-12">
                <Link to={basePath} className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors group">
                    <span className="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">arrow_back</span>
                    <span className="text-xs font-bold uppercase tracking-widest">All {basePath === '/compare' ? 'Comparisons' : 'Articles'}</span>
                </Link>
            </div>

            {/* Article Header */}
            <header className="max-w-4xl mx-auto px-6 mb-16">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <div className="flex items-center gap-3 mb-6">
                        <span className="py-1 px-3 rounded-md bg-fire-pink/10 border border-fire-pink/20 text-fire-pink text-[10px] font-bold uppercase tracking-widest">
                            Comparison
                        </span>
                        <span className="text-gray-500 text-xs font-medium uppercase tracking-widest">{post.date}</span>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-8 leading-[1.1]">
                        {post.title}
                    </h1>
                    <div className="h-px w-20 bg-gradient-to-r from-fire-pink to-transparent"></div>
                </motion.div>
            </header>

            {/* Main Content Area */}
            <div className="max-w-4xl mx-auto px-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
                    {/* Content */}
                    <article className="lg:col-span-8">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="prose prose-invert prose-headings:tracking-tighter prose-headings:font-black prose-p:text-gray-400 prose-p:leading-relaxed prose-strong:text-white prose-a:text-fire-pink max-w-none"
                            dangerouslySetInnerHTML={{ __html: post.content }}
                        />

                        {/* Feature Comparison Table */}
                        <section className="mt-20">
                            <h2 className="text-3xl font-black tracking-tighter mb-8">Feature Comparison</h2>
                            <div className="glass-card rounded-super overflow-hidden border border-white/5">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white/5">
                                            <th className="p-6 text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-white/5">Feature</th>
                                            <th className="p-6 text-xs font-bold uppercase tracking-widest text-fire-pink border-b border-white/5">FireConnect</th>
                                            <th className="p-6 text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-white/5">{post.competitorName}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {post.comparisonTable.map((row, i) => (
                                            <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="p-6 text-sm font-semibold text-gray-300">{row.feature}</td>
                                                <td className="p-6">
                                                    {typeof row.fireconnect === 'boolean' ? (
                                                        row.fireconnect ? <Check className="text-neon-purple" size={20} /> : <X className="text-gray-600" size={20} />
                                                    ) : (
                                                        <span className="text-sm font-bold text-white">{row.fireconnect}</span>
                                                    )}
                                                </td>
                                                <td className="p-6">
                                                    {typeof row.competitor === 'boolean' ? (
                                                        row.competitor ? <Check className="text-gray-400" size={20} /> : <X className="text-gray-600" size={20} />
                                                    ) : (
                                                        <span className="text-sm font-medium text-gray-500">{row.competitor}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-8 p-6 bg-gradient-to-tr from-neon-purple/20 to-fire-pink/20 rounded-2xl border border-white/10 text-center">
                                <p className="text-sm font-bold text-white mb-4 uppercase tracking-widest">Ready for the better experience?</p>
                                <Link to="/" className="inline-block py-3 px-8 bg-white text-black text-xs font-black uppercase tracking-widest rounded-full hover:scale-105 transition-transform">
                                    Join FireConnect Now
                                </Link>
                            </div>
                        </section>
                    </article>

                    {/* Sidebar / CTA */}
                    <aside className="lg:col-span-4 lg:sticky lg:top-32 h-fit">
                        <div className="glass-card rounded-[32px] p-8 border border-white/5 mb-8">
                            <h4 className="text-xl font-black tracking-tighter mb-4 text-glow">Private & Secure</h4>
                            <p className="text-gray-400 text-sm leading-relaxed mb-6">
                                Join the world's most exclusive network for verified adults. Privacy is at our core.
                            </p>
                            <ul className="space-y-4 mb-8">
                                <li className="flex items-center gap-3 text-xs font-bold text-gray-300">
                                    <span className="material-symbols-outlined text-neon-purple text-lg">verified</span>
                                    Verified Members
                                </li>
                                <li className="flex items-center gap-3 text-xs font-bold text-gray-300">
                                    <span className="material-symbols-outlined text-neon-purple text-lg">lock</span>
                                    Encrypted Vaults
                                </li>
                                <li className="flex items-center gap-3 text-xs font-bold text-gray-300">
                                    <span className="material-symbols-outlined text-neon-purple text-lg">visibility_off</span>
                                    No Data Tracking
                                </li>
                            </ul>
                            <Link to="/" className="flex items-center justify-center w-full py-4 bg-fire-pink text-white text-xs font-black uppercase tracking-widest rounded-full shadow-lg shadow-fire-pink/20 hover:shadow-fire-pink/40 transition-all">
                                Get Started
                            </Link>
                        </div>

                        <div className="px-4 py-8 rounded-[32px] border border-white/5 bg-white/5">
                            <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-6 px-4">Latest Advice</h4>
                            <div className="space-y-6">
                                {Object.values(BLOG_POSTS).filter(p => p.slug !== post.slug).map(other => (
                                    <Link key={other.slug} to={`${basePath}/${other.slug}`} className="group block px-4 transition-all">
                                        <p className="text-sm font-bold text-gray-400 group-hover:text-white transition-colors line-clamp-2 leading-snug">
                                            {other.title}
                                        </p>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
};

export default BlogDetail;
