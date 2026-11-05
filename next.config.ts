import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: ["acceptable-unalarmed-haleigh.ngrok-free.dev"],
};

export default nextConfig;
