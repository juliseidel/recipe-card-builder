// Headless Chromium launcher for Vercel serverless.
//
// We use @sparticuz/chromium-min instead of @sparticuz/chromium: the -min
// variant ships zero binaries (~120 KB total) so it fits trivially in the
// Vercel function bundle. The actual Chromium tar is fetched on first launch
// from the GitHub release matching the package version, extracted to /tmp,
// and reused on warm invocations. Cold start cost: 5–10 s; warm: instant.

import chromium from "@sparticuz/chromium-min";
import puppeteer, { type Browser } from "puppeteer-core";

// Pinned to the chromium-min major version we install. When you bump the
// package, bump this URL too — they must match exactly.
const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v147.0.0/chromium-v147.0.0-pack.x64.tar";

let cached: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (cached && cached.connected) return cached;

  const browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      "--font-render-hinting=none",
      "--disable-web-security",
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
    defaultViewport: { width: 1024, height: 1500, deviceScaleFactor: 1 },
    executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
    headless: true,
  });

  cached = browser;
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (cached) {
    try {
      await cached.close();
    } catch {
      // ignore
    }
    cached = null;
  }
}

// Resolves the absolute origin Puppeteer should hit. On Vercel preview/prod
// VERCEL_PROJECT_PRODUCTION_URL is set; on previews VERCEL_URL is set. Falls
// back to localhost:3000 for local dev (system Chrome required).
export function getOrigin(): string {
  if (process.env.PUPPETEER_TARGET_ORIGIN) {
    return process.env.PUPPETEER_TARGET_ORIGIN;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
