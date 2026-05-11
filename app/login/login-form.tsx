"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

// Login-Form Client Component. Email + Password — ein Tool, das mit
// Creator-Credentials uebergeben wird, kein Magic-Link-Flow noetig.
// useActionState bringt Server-Errors direkt zurueck ins Form, ohne
// Client-Fetch.
//
// Visuelle Sprache: typografisch (Display-Serif Wortmarke "Recipe Card
// Builder"), kein Logo-Icon — das Logo gefiel dem User nicht, und ohne
// es atmet die Page deutlich besser. Cream-Hintergrund, ein Card mit
// Form, alles sehr ruhig. Der Wow-Moment ist post-login auf /welcome.

const initialState: LoginState = { error: null };

type Props = {
  redirectTo: string;
};

export function LoginForm({ redirectTo }: Props) {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState
  );

  return (
    <main className="bg-canvas flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-[440px]">
        <div className="mb-9 flex flex-col items-center gap-2.5 text-center">
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.28em] text-ink-subtle">
            Internes Studio · Brand-Workspace
          </span>
          <h1 className="font-display text-[44px] leading-[1.0] tracking-[-0.02em] text-ink sm:text-[52px]">
            Recipe Card Builder
          </h1>
          <p className="mt-1 max-w-[340px] text-[13.5px] leading-relaxed text-ink-muted">
            Druckfertige Rezeptkarten kuratieren — pro Creator-Brand, im
            gemeinsamen Team-Workspace.
          </p>
        </div>

        <form
          action={formAction}
          className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-7 shadow-[var(--shadow-card)]"
        >
          <div className="flex flex-col gap-1.5">
            <h2 className="font-display text-[22px] leading-tight text-ink">
              Anmelden
            </h2>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              Mit deinem Team-Zugang anmelden und den Brand-Workspace
              öffnen.
            </p>
          </div>

          <input type="hidden" name="redirect" value={redirectTo} />

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-ink">
              E-Mail
            </span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              autoFocus
              placeholder="creator@example.com"
              className="rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-ink"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-ink">
              Passwort
            </span>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-ink"
            />
          </label>

          {state.error ? (
            <div
              className="rounded-xl border px-3.5 py-2.5 text-[12.5px] leading-relaxed"
              style={{
                borderColor: "#dc2626",
                background: "#fee2e2",
                color: "#991b1b",
              }}
              role="alert"
            >
              {state.error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
          >
            {isPending ? (
              <>
                <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Anmelden…
              </>
            ) : (
              <>
                Workspace öffnen
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-[11.5px] leading-relaxed text-ink-subtle">
          Noch kein Account? Kontakt zu deinem Recipe-Card-Builder-Admin.
        </p>
      </div>
    </main>
  );
}
