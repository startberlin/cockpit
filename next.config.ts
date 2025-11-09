import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/onboarding",
        destination: "/onboarding/welcome",
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
