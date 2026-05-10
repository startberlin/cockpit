import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
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
