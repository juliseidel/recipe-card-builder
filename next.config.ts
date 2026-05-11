import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // @ffmpeg-installer/ffmpeg macht dynamische require()-Calls zu plattform-
  // spezifischen Binaries (darwin-arm64, linux-x64, …) — Webpack/Turbopack
  // koennen das nicht statisch resolven. serverExternalPackages laesst die
  // Module zur Runtime im node_modules-Layer, statt sie zu bundlen.
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg"],
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
    // Hero-Pipeline (Phase-3-Rebuild) braucht das ffmpeg-binary in der
    // Lambda-Bundle. @ffmpeg-installer/ffmpeg liefert plattform-spezifische
    // Binaries als optional deps; auf Vercel-Build (linux-x64) muss
    // explizit das richtige Binary-Folder eingeschlossen werden, sonst
    // findet ffmpegInstaller.path zur Runtime nichts.
    "/api/recipes/enrich": [
      "./node_modules/@ffmpeg-installer/**/*",
    ],
    "/api/admin/reseed-heroes": [
      "./node_modules/@ffmpeg-installer/**/*",
    ],
  },
};

export default nextConfig;
