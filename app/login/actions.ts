"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/auth/server";

// Server Actions for the login page. Email+Password is the simpler login
// flow for a tool that's handed to a creator with credentials — no email
// roundtrip, works offline-ish.
//
// On success, we redirect to /welcome so the creator sees the branded
// transition animation before landing in their workspace. /welcome reads
// the user's metadata to pick the right brand-slug to bounce to.

export type LoginState = {
  error: string | null;
};

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "");

  if (!email || !password) {
    return { error: "Bitte E-Mail und Passwort ausfüllen." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase's default error messages are English + cryptic. We map the
    // most common ones to friendly German for the creator.
    let message = "Anmeldung fehlgeschlagen. Bitte erneut versuchen.";
    if (error.message.toLowerCase().includes("invalid")) {
      message = "E-Mail oder Passwort ist falsch.";
    } else if (error.message.toLowerCase().includes("not confirmed")) {
      message = "E-Mail noch nicht bestätigt. Bitte Posteingang checken.";
    }
    return { error: message };
  }

  revalidatePath("/", "layout");
  // Pass the original redirect target through to /welcome so it can land
  // the user where they were trying to go. Empty → /welcome decides
  // (default = creator's brand workspace).
  const target = redirectTo
    ? `/welcome?redirect=${encodeURIComponent(redirectTo)}`
    : "/welcome";
  redirect(target);
}

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
