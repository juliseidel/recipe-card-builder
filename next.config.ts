import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    qualities: [75, 90, 95],
  },
  // PDF rendering reads font + brand images at runtime via fs. The dynamic
  // path.join(...) calls don't get traced automatically, so include them
  // explicitly in the API-route function bundles deployed to Vercel.
  outputFileTracingIncludes: {
    "/api/pdf/jobs": [
      "./public/fonts/**/*",
      "./public/brands/**/*",
    ],
    "/api/pdf/jobs/[id]": [
      "./public/fonts/**/*",
      "./public/brands/**/*",
    ],
  },
};

export default nextConfig;
