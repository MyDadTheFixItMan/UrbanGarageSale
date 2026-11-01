import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // `npm run dev:staging`: the site talks to the staging Firebase project, and the dev server
  // forwards /api to the staging API (a protected Vercel preview), adding the bypass secret here
  // so it never reaches the browser. Neither variable has the VITE_ prefix, so neither is bundled.
  const env = loadEnv(mode, __dirname, '')
  const stagingProxy = mode === 'staging' && env.STAGING_API_URL
    ? {
        '/api': {
          target: env.STAGING_API_URL,
          changeOrigin: true,
          headers: env.VERCEL_PROTECTION_BYPASS
            ? { 'x-vercel-protection-bypass': env.VERCEL_PROTECTION_BYPASS }
            : {},
        },
      }
    : undefined

  return {
  plugins: [
    react(),
  ],
  // Production builds drop debug logging (some of it includes user details);
  // console.warn and console.error are kept.
  esbuild: mode === 'production'
    ? { pure: ['console.log', 'console.debug', 'console.info'], drop: ['debugger'] }
    : {},
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Large libraries in their own files so browsers cache them across app updates.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/functions'],
          charts: ['recharts'],
          maps: ['leaflet', 'react-leaflet'],
        },
      },
    },
  },
  server: {
    middlewareMode: false,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
    proxy: stagingProxy,
  },
  };
});
