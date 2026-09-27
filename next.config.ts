import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/topics/native-ranking", destination: "/topics/native-share", permanent: true },
      { source: "/topics/native-trend", destination: "/topics/native-share", permanent: true },
    ];
  },
};

export default nextConfig;
