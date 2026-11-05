import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // The workspace lives in browser storage and renders client-side after
  // hydration, so server Cache Components / partial prefetching don't apply.
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
