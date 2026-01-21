import { Link } from "react-router";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background-dark">
      <div className="flex items-center justify-center size-20 bg-gradient-to-tr from-fire-pink to-neon-purple rounded-3xl shadow-[0_0_40px_rgba(255,0,85,0.4)] mb-8">
        <span className="material-symbols-outlined text-5xl text-white">error</span>
      </div>
      <h1 className="text-4xl font-black text-white mb-4 uppercase tracking-tighter">
        404 <span className="text-transparent bg-clip-text bg-gradient-to-r from-fire-pink to-neon-purple">Lost</span> in Space
      </h1>
      <p className="text-white/60 text-lg mb-8 text-center max-w-md font-medium">
        The page you're looking for doesn't exist or has been moved to another dimension.
      </p>
      <Link
        to="/"
        className="px-8 py-4 bg-gradient-to-r from-fire-pink/20 to-neon-purple/20 hover:from-fire-pink/30 hover:to-neon-purple/30 text-white rounded-2xl font-bold transition-all border border-white/10 flex items-center gap-2 group"
      >
        <span className="material-symbols-outlined transition-transform group-hover:-translate-x-1">arrow_back</span>
        Return Home
      </Link>
    </div>
  );
}
