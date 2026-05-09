import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Auth-check middleware. Refreshes the Supabase session cookie on every
// request and decides whether to redirect.
//
// Public paths that bypass the auth gate:
//   - /login            (the login page itself)
//   - /welcome          (post-login transition; we still need an active
//                        session here, but failure redirects to /login,
//                        not in a loop)
//   - /submission/*     (Pflicht-Lieferung-Hub for Ingo, public download)
//   - /api/pdf/*        (PDF render endpoints called from the editor — we
//                        gate the editor itself, not these)
//   - Static assets are excluded by the matcher in middleware.ts root.
//
// Everything else requires a logged-in user.

const PUBLIC_PATHS = [
  "/login",
  "/submission",
  "/api/pdf",
  "/icon.svg",
  "/apple-icon",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Auth not configured — let everything through. Useful for preview
    // builds where the env vars aren't set.
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Important: this MUST be called to refresh the session cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public path → let through (still refreshed the session cookie above)
  if (isPublic(pathname)) {
    return response;
  }

  // Authenticated → let through
  if (user) {
    return response;
  }

  // Unauthenticated on a protected path → redirect to /login with the
  // intended destination as a query param so the login page can bounce
  // the user back after a successful sign-in.
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  if (pathname !== "/") {
    loginUrl.searchParams.set("redirect", pathname);
  }
  return NextResponse.redirect(loginUrl);
}
