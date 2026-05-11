import { logoutAction } from "@/app/login/actions";
import { BrandSwitcher } from "./brand-switcher";

// Floating Top-Right-Toolbar fuer die App-Shell. Frueher nur der
// Abmelden-Button — mit der Multi-Tenant-Umstellung kam der Brand-
// Switcher dazu, damit der Team-User schnell zwischen Creator-
// Workspaces wechseln kann, ohne den Umweg ueber den Hub.
//
// Layout: ein flex-Container fixed rechts oben, beide Buttons
// nebeneinander. Backdrop-blur fuer Lesbarkeit ueber Hero-Bildern.
//
// BrandSwitcher rendert sich self-detected via usePathname() — nur in
// `/[brand]/...` Routen, sonst null. Auf Hub, Login, Welcome, /new-brand
// ist nur der Abmelden-Knopf sichtbar (bzw. gar nichts, wenn unter
// SiteHeader gewohnte Form-Komponente da nicht gerendert wird).

export function SiteHeader() {
  return (
    <div className="fixed right-4 top-4 z-50 flex items-center gap-2 lg:right-6 lg:top-6">
      <BrandSwitcher />
      <form action={logoutAction}>
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
    </div>
  );
}
