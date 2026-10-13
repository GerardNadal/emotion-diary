import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Microsoft Dev Tunnels forwards its public host while rewriting the
  // Server Action Origin to the local Next.js address.
  allowedDevOrigins: ["vnj207t8-3000.uks1.devtunnels.ms"],
  experimental: {
    serverActions: {
      allowedOrigins: [
        "vnj207t8-3000.uks1.devtunnels.ms",
        "localhost:3000",
      ],
    },
  },
  // Private, request-bound pages. Enable Cache Components only with a reviewed
  // per-user caching design; no cross-request cache for directory/session data.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
