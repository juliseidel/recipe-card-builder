import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    qualities: [75, 90, 95],
    // Hero images for custom recipes are uploaded to Supabase Storage by
    // /api/recipes/enrich. The next/image component blocks external URLs
    // unless the domain is whitelisted here — without this, hero <Image>
    // tags render as broken images even when recipe.hero is set correctly
    // in the database.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
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
