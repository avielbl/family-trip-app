import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
) as { version: string }

/**
 * Every Firebase value the app cannot work without.
 *
 * A missing one does not fail the build on its own — it ships as an empty
 * string and breaks one feature silently at runtime. That is exactly how photo
 * uploads came to stall at 0% with no error: VITE_FIREBASE_STORAGE_BUCKET was
 * absent from the deploy secrets, so every upload addressed a bucket that did
 * not exist. Far better to refuse to build.
 */
const REQUIRED_ENV = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const

export default defineConfig(({ command, mode }) => {
  // Only on a real build: `vite dev` without a full .env is a normal way to
  // work on anything that does not touch Firebase.
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    const missing = REQUIRED_ENV.filter((key) => !env[key]?.trim())
    if (missing.length) {
      throw new Error(
        `Missing required environment variables:\n` +
          missing.map((k) => `  - ${k}`).join('\n') +
          `\n\nThese are read at build time and bake into the bundle. An empty one\n` +
          `does not fail anything visibly — it breaks a feature at runtime with no\n` +
          `error. In CI they come from repository secrets of the same name.`
      )
    }
  }

  return {
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt', 'logo.PNG'],
      manifest: {
        name: 'TripIt',
        short_name: 'TripIt',
        description: 'TripIt — family trip planner',
        theme_color: '#1e40af',
        background_color: '#f0f9ff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/logo.PNG',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/logo.PNG',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Never serve the SPA shell for Firebase reserved URLs — the Google
        // sign-in redirect flow navigates to /__/auth/* on our own origin and
        // must reach the real hosting handler, not the cached index.html.
        navigateFallbackDenylist: [/^\/__\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  }
})
