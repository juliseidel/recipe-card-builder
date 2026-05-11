import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

// Stub fuer das Creator-Onboarding. Die Hub-Card "Neuer Workspace" linkt
// hierhin — in PR 3 wird die Page zu einer richtigen Form (Avatar-Upload,
// Bio, Tagline, Mood-Picker, Display-Font). Fuer jetzt zeigt sie nur den
// Platzhalter, damit die Multi-Tenant-Architektur sichtbar ist, ohne die
// Onboarding-Mechanik schon ausliefern zu muessen.

export const dynamic = "force-dynamic";

export default function NewBrandStubPage() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div
          className="w-full max-w-xl rounded-[28px] border bg-surface p-10 text-center shadow-sm"
          style={{ borderColor: "rgba(43, 31, 25, 0.12)" }}
        >
          <div
            className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full"
            style={{
              background: "rgba(43, 31, 25, 0.06)",
              color: "rgba(43, 31, 25, 0.8)",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1 className="font-display text-[32px] leading-tight tracking-[-0.01em]">
            Neuen Creator anlegen
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
            Das Onboarding-Modul ist auf dem Weg — Avatar-Upload, Bio,
            Tagline, Mood-Picker, Display-Font. Bis dahin kannst du im
            Hub mit den bestehenden Workspaces arbeiten.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-[13px] font-semibold transition-colors hover:bg-canvas"
            style={{
              borderColor: "rgba(43, 31, 25, 0.18)",
              color: "rgba(43, 31, 25, 0.9)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M11 7H3m0 0L6.5 3.5M3 7l3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Zurueck zum Workspace-Hub
          </Link>
        </div>
      </main>
    </div>
  );
}
