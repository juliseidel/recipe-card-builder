import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase Auth client for RSC + route handlers. Reads session
// from the same cookies the browser writes (via @supabase/ssr's cookie
// adapter). Used to check `auth.getUser()` from page.tsx and layout.tsx —
// keeps server-rendered content consistent with the client's auth state.

export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase Auth env vars missing (NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY)"
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies — only Server Actions and
          // route handlers can. Middleware refreshes the session anyway,
          // so this swallow is safe for read-only usage in RSC.
        }
      },
    },
  });
}
