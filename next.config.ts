import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
