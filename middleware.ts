import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/auth/middleware";

// Auth-Middleware. Refreshes the Supabase session cookie + gates protected
// routes. See lib/auth/middleware.ts for the public-path allowlist.

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Match everything except:
    //  - _next/static, _next/image (Next internals)
    //  - favicon, png, jpg, svg, woff (static assets)
    //  - sitemap.xml, robots.txt
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ico)$|sitemap\\.xml|robots\\.txt).*)",
  ],
};
