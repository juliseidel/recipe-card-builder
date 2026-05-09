import { logoutAction } from "@/app/login/actions";

// Frueher: sticky Header-Bar mit Logo + Title + "Studio fuer Creator" +
// "Workspaces"-Link. User-Feedback: zu praesent, das Logo gefaellt nicht,
// "Workspaces"-Link funktioniert seit der Multi-Tenant-Umstellung
// nicht mehr.
//
// Jetzt: minimaler floating "Abmelden"-Button oben rechts. Kein Streifen,
// keine Logo-Marke, kein Title — die App-Seiten haben ihren eigenen
// visuellen Anker (Brand-Hero, Pack-Cover, Editor-Form). Der Abmelden-
// Knopf ist subtle und nimmt nichts von der Page weg.
//
// Pattern: SiteHeader bleibt als Component-Name (alle Pages importieren
// ihn schon), aber rendert nur noch den Floating-Knopf. Position fixed,
// klickbar ueber dem Page-Content, mit einem subtle backdrop-blur
// damit er auch ueber Hero-Bildern lesbar bleibt.

export function SiteHeader() {
  return (
    <form
      action={logoutAction}
      className="fixed right-4 top-4 z-50 lg:right-6 lg:top-6"
    >
      <button
        type="submit"
        title="Abmelden"
        aria-label="Abmelden"
        className="group inline-flex items-center gap-1.5 rounded-full border border-line/60 bg-surface/85 px-3.5 py-1.5 text-[12px] font-medium text-ink-muted backdrop-blur-md transition-all duration-200 hover:border-line hover:bg-surface hover:text-ink hover:shadow-[0_4px_12px_-4px_rgba(43,31,25,0.15)]"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        >
          <path
            d="M5.5 2H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2.5M9 4.5L11.5 7M11.5 7L9 9.5M11.5 7H6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Abmelden
      </button>
    </form>
  );
}
