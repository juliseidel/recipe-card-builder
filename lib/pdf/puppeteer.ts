// Headless Chromium launcher for Vercel serverless. Uses @sparticuz/chromium —
// the binary is fetched from the package's GitHub-Releases mirror at first
// invocation and cached in /tmp, so cold starts pay ~5–10 s but warm starts
// reuse the same instance.

import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";

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
    executablePath: await chromium.executablePath(),
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
