"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase Auth client. Uses cookies for session storage so
// the server (middleware, RSC) can read the same session. Returns null when
// the env vars are missing — caller falls back to "no auth" mode (the App
// then renders without login flow, useful for preview environments where
// Supabase isn't wired up yet).

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase Auth env vars missing (NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY)"
    );
  }
  return createBrowserClient(url, anonKey);
}
