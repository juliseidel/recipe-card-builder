import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Auth-Middleware mit drei Optimierungs-Stufen, damit Page-Navigation
// schnell bleibt:
//
//   1. Public paths: SOFORT durchlassen, kein Supabase-Client, kein
//      Auth-Call. Spart ~50-200 ms pro Navigation auf /login, /welcome,
//      /submission, /api/pdf.
//
//   2. Kein Auth-Cookie: SOFORT zum /login redirecten. User ist
//      definitiv nicht authentifiziert — eine Server-Validation des
//      nicht-existenten Tokens waere reine Latenz.
//
//   3. Auth-Cookie da: dann erst createServerClient + getUser. Das ist
//      der einzige Pfad, der einen JWT-Decode + (bei Token-Refresh)
//      einen Roundtrip zu Supabase macht.
//
// Public paths:
//   /login, /welcome, /submission, /api/pdf, /icon.svg, /apple-icon.
//   Static assets sind schon ueber den Matcher in middleware.ts
//   ausgeschlossen.

const PUBLIC_PATHS = [
  "/login",
  "/welcome",
  "/submission",
  "/api/pdf",
  // /api/admin/* checked Auth selber via Bearer-Token mit SUPABASE_SERVICE_ROLE_KEY.
  // Wird nur fuer einmalige Bulk-Operationen (z. B. Hero-Reseed) gebraucht.
  "/api/admin",
  "/icon.svg",
  "/apple-icon",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

// Erkennt das supabase-ssr Auth-Cookie. Es heisst typischerweise
// `sb-<project-ref>-auth-token` und kann in Chunks aufgeteilt sein
// (`...auth-token.0`, `...auth-token.1`, …). Ein Match auf irgendeinem
// dieser Cookies reicht — wir validieren spaeter den Inhalt.
function hasAuthCookie(request: NextRequest): boolean {
  for (const cookie of request.cookies.getAll()) {
    if (/^sb-.+-auth-token(\.\d+)?$/.test(cookie.name)) {
      return true;
    }
  }
  return false;
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  if (request.nextUrl.pathname !== "/") {
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Stufe 1: Public-Path-Bypass — kein Auth, kein Supabase-Client.
  if (isPublic(pathname)) {
    return NextResponse.next({ request });
  }

  // Welcome ist technisch in der Allowlist, weil die Welcome-Animation
  // nicht in einer Login-Loop landen soll, wenn das Cookie kurz nach
  // dem signIn noch nicht gesetzt ist. Wir gucken aber NICHT mehr in
  // die Middleware fuer /welcome — die Page selbst checkt auth und
  // redirected bei Bedarf.

  // Stufe 2: Kein Auth-Cookie → sofort redirecten.
  // Spart den ServerClient + getUser() fuer alle anonymen Besucher.
  if (!hasAuthCookie(request)) {
    return redirectToLogin(request);
  }

  // Stufe 3: Auth-Cookie da, jetzt validieren.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Auth nicht konfiguriert (z. B. Preview-Build) — durchlassen.
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
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

  // getUser() laeuft fast immer rein lokal (JWT-Decode + expiration-
  // check). Nur wenn der Access-Token abgelaufen ist macht es einen
  // Refresh-Roundtrip — das ist erwartetes Verhalten und unvermeidbar.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return response;
  }

  return redirectToLogin(request);
}
