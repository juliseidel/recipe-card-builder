// Plattform-Detection + URL-Normalisierung fuer Instagram + TikTok.
// Wird vom Onboarding (Profil-Import), vom Recipe-Import (URL-Form) und
// vom Reel-Backfill genutzt — alle drei Pfade muessen wissen, ob sie den
// Instagram- oder den TikTok-Apify-Actor ansprechen.
//
// Design-Prinzip: Plattform wird IMMER aus der URL/dem Handle abgeleitet,
// nicht aus User-Input. So koennen wir auch ohne expliziten Tab-Switch
// reagieren, wenn der User einfach einen Link einwirft.

export type SocialPlatform = "instagram" | "tiktok";

const INSTAGRAM_HOSTS = ["instagram.com", "m.instagram.com"];
const TIKTOK_HOSTS = [
  "tiktok.com",
  "m.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
];

/** Erkennt die Plattform aus einer beliebigen URL. Gibt null zurueck,
 *  wenn weder Instagram noch TikTok matched — der Caller kann dann z.B.
 *  einen Fehler werfen oder einen Default annehmen. */
export function detectPlatformFromUrl(
  url: string | null | undefined
): SocialPlatform | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (INSTAGRAM_HOSTS.includes(host)) return "instagram";
  if (TIKTOK_HOSTS.includes(host)) return "tiktok";
  return null;
}

/** Normalisiert einen User-getippten Handle ("@user", "user", "@user@",
 *  "  user  ") zu der minimalen Form ohne @-Prefix. Wirft nicht — fuer
 *  Validierung muss der Caller selbst checken (z.B. via regex). */
export function normalizeHandle(raw: string): string {
  return raw.replace(/^@+/, "").trim();
}

/** Erkennt die Plattform anhand des Handle-Inputs UND eines optionalen
 *  Hints (z.B. aus einem Tab-Switcher in der UI). Bei nicht-eindeutigen
 *  Handles (beide Plattformen akzeptieren die gleichen Zeichen) gewinnt
 *  der Hint. Default: instagram (historisch der Original-Pfad). */
export function detectPlatformFromHandle(
  _handle: string,
  hint?: SocialPlatform | null
): SocialPlatform {
  return hint ?? "instagram";
}

/** Validiert einen Handle gegen das gemeinsame Zeichenset von Instagram
 *  und TikTok (a-z, A-Z, 0-9, Punkt, Unterstrich). TikTok erlaubt
 *  technisch auch Bindestriche, aber in der Praxis sind die selten und
 *  produzieren Apify-Edge-Cases — wir bleiben restriktiv. */
export function isValidHandle(handle: string): boolean {
  const cleaned = normalizeHandle(handle);
  return cleaned.length > 0 && /^[A-Za-z0-9._]+$/.test(cleaned);
}

/** Menschlich lesbares Label fuer die Plattform. UI nutzt das fuer
 *  Buttons, Status-Banner, Source-Attribution. */
export function platformLabel(platform: SocialPlatform): string {
  return platform === "instagram" ? "Instagram" : "TikTok";
}

/** Profile-URL fuer einen Handle auf der angegebenen Plattform. Wird
 *  vom Apify-Wrapper genutzt, der die URL als directUrl mitschickt. */
export function profileUrlFor(
  platform: SocialPlatform,
  handle: string
): string {
  const clean = normalizeHandle(handle);
  if (platform === "tiktok") {
    return `https://www.tiktok.com/@${clean}`;
  }
  return `https://www.instagram.com/${clean}/`;
}
