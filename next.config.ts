import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
    unoptimized: true,
  },
  // Ensure environment variables are available
  env: {
    // Public vars are automatically handled by Next.js (NEXT_PUBLIC_*)
  }
};

export default nextConfig;
