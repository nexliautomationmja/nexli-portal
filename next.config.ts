import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Creative Studio auto-cut runs ffmpeg on the server: ship the Linux
  // binary from @ffmpeg-installer with the cut routes.
  outputFileTracingIncludes: {
    "/api/dashboard/creative-studio/projects/[projectId]/cut/**": ["./node_modules/@ffmpeg-installer/linux-x64/**"],
    "/api/dashboard/creative-studio/projects/[projectId]/edit/**": ["./node_modules/@ffmpeg-installer/linux-x64/**"],
    // Reaction videos: stills and the light copy of the video she reacts to.
    "/api/dashboard/creative-studio/projects/[projectId]/source/**": ["./node_modules/@ffmpeg-installer/linux-x64/**"],
    "/api/dashboard/creative-studio/ad-copy/**": ["./node_modules/@ffmpeg-installer/linux-x64/**"],
    // Ads grader: watches past ads and new creatives (stills at chosen seconds); the cron carries it on.
    "/api/dashboard/ads/grader/**": ["./node_modules/@ffmpeg-installer/linux-x64/**"],
    "/api/cron/ads": ["./node_modules/@ffmpeg-installer/linux-x64/**"],
  },
};

export default nextConfig;
