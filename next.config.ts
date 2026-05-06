import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    qualities: [75, 90, 95],
  },
  // Puppeteer + @sparticuz/chromium ship native binaries that webpack must not
  // try to bundle. Marking them external means they're require()d at runtime
  // from node_modules instead of being inlined into the function bundle.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // PDF rendering reads font + brand images at runtime. The font files are
  // still used by the legacy @react-pdf renderer (kept around as fallback);
  // the brand images are read by the print routes via Next/Image. Bundling
  // them into the API-route function ensures everything is available even
  // when serverless functions can't reach the public/ statically.
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
