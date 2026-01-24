import path from 'node:path';
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
      host: '0.0.0.0',
    },
    plugins: [reactRouter()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      chunkSizeWarningLimit: 1000,
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router',
        'react-router-dom',
        'canvas-confetti',
        'framer-motion',
        '@supabase/supabase-js',
        '@supabase/ssr',
      ],
    },
  };
});
