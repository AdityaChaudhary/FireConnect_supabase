import type { Config } from "@react-router/dev/config";
import { vercelPreset } from "@vercel/react-router/vite";

export default {
  // Use the Vercel preset for SSR support
  presets: [vercelPreset()],
  ssr: true,
} satisfies Config;
