import type { NextConfig } from "next";

import { demographicsData, slugify } from "./src/lib/demographics";

// Europe moved under /europe when the US became the home page.
const EUROPE_TOPICS = ["map", "native-share", "anti-immigration", "market-cap", "median-age"];
const europeanSlugs = demographicsData
  .map((d) => slugify(d.country))
  .filter((slug) => slug !== "united-states");

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/topics/native-ranking", destination: "/europe/topics/native-share", permanent: true },
      { source: "/topics/native-trend", destination: "/europe/topics/native-share", permanent: true },
      { source: "/state/:slug", destination: "/united-states/:slug", permanent: true },
      { source: "/united-states", destination: "/", permanent: true },
      ...EUROPE_TOPICS.map((slug) => ({
        source: `/topics/${slug}`,
        destination: `/europe/topics/${slug}`,
        permanent: true,
      })),
      ...europeanSlugs.map((slug) => ({
        source: `/${slug}`,
        destination: `/europe/${slug}`,
        permanent: true,
      })),
    ];
  },
};

export default nextConfig;
