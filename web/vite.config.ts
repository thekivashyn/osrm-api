import type { IncomingMessage } from "node:http";
import type { ClientRequest } from "node:http";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function forwardClientIp() {
  return {
    name: "forward-client-ip",
    configureServer(server: { middlewares: { use: (fn: (req: IncomingMessage, res: unknown, next: () => void) => void) => void } }) {
      server.middlewares.use((req, _res, next) => {
        const raw = req.socket?.remoteAddress?.replace(/^::ffff:/, "") ?? "127.0.0.1";
        req.headers["x-forwarded-for"] = raw;
        next();
      });
    },
    configurePreviewServer(server: { middlewares: { use: (fn: (req: IncomingMessage, res: unknown, next: () => void) => void) => void } }) {
      server.middlewares.use((req, _res, next) => {
        const raw = req.socket?.remoteAddress?.replace(/^::ffff:/, "") ?? "127.0.0.1";
        req.headers["x-forwarded-for"] = raw;
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), forwardClientIp()],
  server: {
    port: 80,
    strictPort: false,
    host: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq: ClientRequest, req: IncomingMessage) => {
            const raw = req.socket?.remoteAddress?.replace(/^::ffff:/, "") ?? "127.0.0.1";
            proxyReq.setHeader("X-Forwarded-For", raw);
          });
        },
      },
      "/health": { target: "http://127.0.0.1:8080", changeOrigin: true },
    },
  },
  preview: {
    port: 80,
    strictPort: false,
    host: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:8080", changeOrigin: true },
      "/health": { target: "http://127.0.0.1:8080", changeOrigin: true },
    },
  },
});
