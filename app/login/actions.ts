"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/auth/server";

// Server Actions for the login page. Email+Password is the simpler login
// flow for an internal team tool — no email roundtrip, works offline-ish.
//
// Multi-Tenant-Update: nach erfolgreichem Login redirected die Action
// zum Workspace-Hub (`/`) statt zur Welcome-Animation. Der Team-Member
// soll sich seinen Creator-Workspace aus der Uebersicht aussuchen — die
// cinematische Welcome-Animation laeuft dann pro Card-Klick im Hub
// (`/welcome?brand=<slug>`). Wer eine Deep-Link wie
// `/biene/feierabend-klassiker/blech-pasta` direkt anfaehrt, kommt nach
// Login direkt dahin (`redirect`-Param wird durchgereicht).

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
  // Wer eine Deep-Link aufgerufen hat (Middleware setzt ?redirect=...
  // wenn der User auf /biene/... ohne Login klickt), landet direkt dort.
  // Sonst: Workspace-Hub. Welcome-Animation laeuft nicht mehr direkt
  // nach Login — die kommt erst beim Card-Klick im Hub.
  const target =
    redirectTo &&
    redirectTo.startsWith("/") &&
    !redirectTo.startsWith("/login")
      ? redirectTo
      : "/";
  redirect(target);
}

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
