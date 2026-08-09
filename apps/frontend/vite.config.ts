import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
  preview: {
    host: true,
    // Vite's preview server rejects requests whose Host header isn't on
    // an allow-list; Railway's healthcheck and public domain are dynamic
    // (*.up.railway.app), so there's no fixed host to allow-list here.
    allowedHosts: true,
  },
});
