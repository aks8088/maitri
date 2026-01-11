import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",   // ✅ THIS IS THE MOST IMPORTANT LINE FOR VERCEL

  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "logo192.png", "logo512.png"],
      manifest: {
        name: "Astronaut Wellness App",
        short_name: "Maitri",
        description: "Offline Astronaut Mental Health Tracker",
        theme_color: "#0B1120",
        background_color: "#0B1120",
        display: "standalone",
        start_url: "./",
        icons: [
          {
            src: "./logo192.png",   // ✅ FIXED PATH
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "./logo512.png",   // ✅ FIXED PATH
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === self.location.origin,
            handler: "CacheFirst",
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
});
