import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  // unsafe-eval is required by React in development for callstack reconstruction; never used in production
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  // Google OAuth profile pictures served from lh3.googleusercontent.com
  "img-src 'self' data: blob: https://lh3.googleusercontent.com",
  "font-src 'self'",
  // photon.komoot.io: address autocomplete; vitals.vercel-insights.com: Speed Insights reporting
  // wss://rt.inngest.com: Inngest Realtime WebSocket (prod); ws://127.0.0.1:8288: Inngest dev server
  `connect-src 'self' https://photon.komoot.io https://vitals.vercel-insights.com wss://rt.inngest.com${isDev ? " ws://127.0.0.1:8288" : ""}`,
  "frame-src https://accounts.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
]
  .join("; ")
  .concat(";");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@react-pdf/renderer"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/onboarding",
        destination: "/onboarding/welcome",
        permanent: true,
      },
      {
        source: "/membership/application",
        destination: "/membership/application/personal-information",
        permanent: true,
      },
      {
        source: "/",
        destination: "/membership",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
