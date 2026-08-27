import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Load VITE_* from election-portal/.env even though Vite root is client/
  envDir: path.resolve(import.meta.dirname),
  plugins: [
    react(),
    runtimeErrorOverlay(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: [
        "app-icon.png",
        "logo.png",
        "apple-touch-icon.png",
        "offline.html",
      ],
      manifest: {
        name: "Vote+ Election Management",
        short_name: "Vote+",
        description: "Comprehensive Election Management System",
        theme_color: "#2563EB",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        categories: ["productivity", "utilities"],
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        screenshots: [],
      },
      workbox: {
        // Precache only the static app shell. Data is never precached.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        offlineGoogleAnalytics: false,
        // SPA shell on failed navigations — NOT offline.html (that caused false
        // "You're Offline" screens during login/logout full-page redirects).
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
        runtimeCaching: [
          {
            // All API traffic ALWAYS goes to the network — no caching (any method).
            urlPattern: ({ url }) => {
              if (url.pathname.startsWith("/api/")) return true;
              const api = (process.env.VITE_API_URL || "").replace(/\/$/, "");
              return Boolean(api) && url.href.startsWith(`${api}/`);
            },
            handler: "NetworkOnly",
          },
          {
            // Google Fonts stylesheets — stale-while-revalidate so fonts
            // load instantly on repeat visits.
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Google Fonts actual font files — cache-first (immutable).
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Static images from our own origin — cache-first with 30-day TTL.
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /\.(png|jpg|jpeg|svg|gif|webp|ico)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
      devOptions: {
        // Keep the service worker off during dev to avoid stale HMR caching.
        enabled: false,
      },
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
});
