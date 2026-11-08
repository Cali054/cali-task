import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Supabase (Google sign-in + workspace sync) is the only other origin the app
// talks to; Google profile photos load from Google's image CDN.
function originOf(url: string | undefined) {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}
const supabaseOrigin = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseConnect = supabaseOrigin ? ` ${supabaseOrigin} ${supabaseOrigin.replace(/^http/, "ws")}` : "";

// Next.js and the theme boot script use inline scripts, and Motion sets inline
// styles, so 'unsafe-inline' is required for both. Everything else is locked
// to this origin. Dev additionally needs eval and a websocket for hot reload.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "font-src 'self' data:",
  `connect-src 'self'${supabaseConnect}${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  // The workspace lives in browser storage and renders client-side after
  // hydration, so server Cache Components / partial prefetching don't apply.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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
