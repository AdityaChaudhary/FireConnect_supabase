import React from 'react';
import { Link } from 'react-router';
import { BLOG_POSTS } from '../lib/blog-data';
import type { MetaFunction } from "react-router";
import { motion } from 'framer-motion';
import { useLoaderData } from 'react-router';

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    const isCompare = data?.basePath === '/compare';
    return [
        { title: isCompare ? "FireConnect Comparisons | Premium Adult Discovery Alternative" : "FireConnect Blog | Intimacy, Privacy & Discovery Advice" },
        { name: "description", content: isCompare ? "See how FireConnect compares to Tinder, Omegle, and other platforms. Why premium privacy and verified discovery win every time." : "Explore the FireConnect blog for insights on modern adult connections, privacy in dating, and why FireConnect is the leading alternative to traditional apps." },
        { property: "og:title", content: isCompare ? "FireConnect Comparisons" : "FireConnect Blog - Premium Adult Discovery" },
        { property: "og:type", content: "website" },
    ];
};

export async function loader({ request }: { request: Request }) {
    const url = new URL(request.url);
    const basePath = url.pathname.startsWith('/compare') ? '/compare' : '/blog';
    return { posts: Object.values(BLOG_POSTS), basePath };
}

const BlogList: React.FC = () => {
    const { posts, basePath } = useLoaderData<typeof loader>();

    return (
        <div className="min-h-screen bg-background-dark text-white font-sans selection:bg-fire-pink selection:text-white">
            {/* Header / Intro */}
            <section className="relative pt-32 pb-20 overflow-hidden">
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-neon-purple/10 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow"></div>
                <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-fire-pink/10 rounded-full blur-[100px] mix-blend-screen animate-pulse-slow"></div>
                
                <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <span className="inline-block py-1 px-4 rounded-full bg-white/5 border border-white/10 text-fire-pink text-xs font-bold tracking-[0.2em] uppercase mb-6">
                            {basePath === '/compare' ? 'Comparison Guide' : 'Discovery Journal'}
                        </span>
                        <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-tight">
                            The <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-fire-pink">FireConnect</span> {basePath === '/compare' ? 'Comparison' : 'Blog'}
                        </h1>
                        <p className="text-gray-400 text-xl font-light leading-relaxed max-w-2xl mx-auto">
                            Insights into the world of premium adult connections, privacy, and why the future of {basePath === '/compare' ? 'choice' : 'discovery'} is exclusive.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Post Grid */}
            <section className="pb-32 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {posts.map((post, index) => (
                            <motion.div
                                key={post.slug}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                            >
                                <Link to={`${basePath}/${post.slug}`} className="group block h-full">
                                    <div className="glass-card rounded-super p-1 h-full flex flex-col transition-all duration-300 group-hover:bg-white/5 group-hover:-translate-y-2 border border-white/5 group-hover:border-neon-purple/30">
                                        <div className="relative aspect-[16/9] rounded-[28px] overflow-hidden mb-6">
                                            <div className="absolute inset-0 bg-gradient-to-tr from-neon-purple/20 to-fire-pink/20 opacity-60 group-hover:opacity-100 transition-opacity"></div>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-6xl text-white/20 group-hover:text-white/40 group-hover:scale-110 transition-all duration-500">
                                                    {post.slug.includes('tinder') ? 'favorite' : post.slug.includes('omegle') ? 'video_chat' : 'forum'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="px-5 pb-6 flex-grow flex flex-col">
                                            <div className="flex items-center gap-3 mb-4">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-fire-pink">Comparison</span>
                                                <span className="w-1 h-1 rounded-full bg-white/20"></span>
                                                <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">{post.date}</span>
                                            </div>
                                            <h3 className="text-xl font-bold text-white mb-4 line-clamp-2 leading-tight group-hover:text-neon-purple transition-colors">
                                                {post.title}
                                            </h3>
                                            <p className="text-gray-500 text-sm leading-relaxed mb-6 line-clamp-3">
                                                {post.excerpt}
                                            </p>
                                            <div className="mt-auto pt-6 border-t border-white/5 flex items-center gap-2 text-white text-xs font-bold uppercase tracking-wider group-hover:gap-4 transition-all">
                                                Read Article 
                                                <span className="material-symbols-outlined text-sm text-fire-pink">arrow_forward</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default BlogList;
