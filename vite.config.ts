import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// The local Bedrock backend (server/index.ts). Both the dev server and `vite preview`
// forward /api to it, so the browser never sees AWS credentials.
const apiProxy = { "/api": { target: "http://127.0.0.1:8787", changeOrigin: true } };

// https://vitejs.dev/config/
export default defineConfig({
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "favicon.ico", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "Lifeline: Verified help when the power goes out",
        short_name: "Lifeline",
        description:
          "Verified, offline-ready finder for pharmacies, food, cooling centers and charging spots in San José.",
        start_url: "/",
        display: "standalone",
        background_color: "#fef9ef",
        theme_color: "#075d60",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // The app shell and the verified dataset (bundled into the JS) are precached,
        // so search, listings and the map markers work with no signal at all.
        globPatterns: ["**/*.{js,css,html,svg,png,json,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: "CacheFirst",
            options: {
              cacheName: "fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Map tiles the resident has already looked at stay available offline.
            urlPattern: /^https:\/\/([abcd]\.)?(tile\.openstreetmap\.org|basemaps\.cartocdn\.com)\/.*/,
            handler: "CacheFirst",
            options: {
              cacheName: "map-tiles",
              expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
