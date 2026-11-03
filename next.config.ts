import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Creative Studio auto-cut runs ffmpeg on the server: keep ffmpeg-static
  // as a runtime require and ship its binary with the cut routes.
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/dashboard/creative-studio/projects/[projectId]/cut/**": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
};

export default nextConfig;
