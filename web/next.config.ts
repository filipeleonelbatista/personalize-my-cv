import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  additionalPrecacheEntries: [{ url: "/offline", revision: "v1" }],
});

const nextConfig: NextConfig = { output: "export" };
export default withSerwist(nextConfig);
