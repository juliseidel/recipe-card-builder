// Apify-Client für Instagram-Post-Scraping. Wir nutzen den "instagram-post-
// scraper" Actor und den synchronen "run-sync-get-dataset-items"-Endpoint:
// schickt einen Run los, wartet bis Apify fertig ist, gibt das Dataset direkt
// zurück. Kein Polling-Loop noetig, kein eigener Job-State.
//
// Docs: https://apify.com/apify/instagram-post-scraper

const APIFY_BASE = "https://api.apify.com/v2";
// Apify-Actor-ID für den Instagram-Scraper. "~"-Form (statt "/") weil
// die Apify-API in URL-Pfaden Tilden statt Slashes erwartet.
//
// Wir nutzen "instagram-scraper" (den universellen, nicht
// "instagram-post-scraper"). Grund: post-scraper verlangt einen Username
// als Pflicht-Input — wir wollen aber direkt URL-basiert scrapen, ohne
// dass der User vorher den Account-Namen separat eintippen muss.
const ACTOR_ID = "apify~instagram-scraper";

export type InstagramPost = {
  /** Vollstaendige Bildunterschrift / Caption — das ist, was Gemini parst. */
  caption: string;
  /** Hauptbild-URL (CDN, public). Bei Reels: Cover-Frame. */
  displayUrl: string | null;
  /** Direkt-Download-URL fuer das Reel-Video (MP4). Wird von der Hero-
   *  Pipeline gebraucht, um per ffmpeg Keyframes aus dem Video zu ziehen,
   *  statt das Cover-Thumbnail (= das vom Creator designte Click-Bait-
   *  Bild mit Werbe-Overlays) als Hero zu nutzen.
   *  null fuer Image-Posts ohne Video. */
  videoUrl: string | null;
  /** Laenge des Videos in Sekunden, fuer ffmpeg-Frame-Timing. */
  videoDuration: number | null;
  /** URL des Posts selbst — für Source-Attribution. */
  postUrl: string;
  /** @username des Erstellers (z. B. "bienesfitlife"). */
  ownerUsername: string | null;
  /** Hashtags des Posts (ohne #-Prefix). */
  hashtags: string[];
  /** Typ des Posts: "Image", "Video" (Reel), "Sidecar" (Carousel). */
  type: string | null;
};

export class ApifyError extends Error {
  constructor(
    message: string,
    public status?: number,
    public detail?: unknown
  ) {
    super(message);
    this.name = "ApifyError";
  }
}

// Akzeptiert ALLE Instagram-URL-Formate, die Creators reinwerfen koennten:
//   https://www.instagram.com/p/SHORTCODE/
//   https://www.instagram.com/reel/SHORTCODE/
//   https://www.instagram.com/reels/SHORTCODE/
//   https://instagram.com/p/SHORTCODE/?igsh=...
//   instagram.com/p/SHORTCODE
// Trim, normalisiert auf https, schneidet Query-Strings ab — Apify will den
// reinen Permalink ohne Tracking-Params.
export function normalizeInstagramUrl(raw: string): string | null {
  if (!raw) return null;
  let url = raw.trim();
  if (!url) return null;

  // Schema händisch ergänzen wenn der User nur "instagram.com/p/..." kopiert.
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "instagram.com" && host !== "m.instagram.com") {
    return null;
  }

  // Pfad muss /p/<code>/, /reel/<code>/ oder /reels/<code>/ sein. Das
  // Trailing-Slash schreibt Apify selbst dran — wir liefern es trotzdem mit.
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const [type, code] = segments;
  if (!/^[A-Za-z0-9_-]+$/.test(code ?? "")) return null;
  if (!["p", "reel", "reels", "tv"].includes(type)) return null;

  // Wir kanonisieren auf /p/<code>/ — Apify akzeptiert das für Reels und
  // Posts gleichermassen, und es haelt den Cache-Key konsistent.
  return `https://www.instagram.com/${type}/${code}/`;
}

// ─── Profile-Scraping fuer Creator-Onboarding ──────────────────────────────
// Beim Hub-Onboarding tippt der Team-User den Instagram-Handle und alle
// Profil-Felder + Avatar werden auto-befuellt. Apify's "instagram-scraper"
// mit resultsType: "details" liefert Profile-Daten + die letzten N Posts
// in einem Call — sparen einen zweiten Roundtrip fuer die Posts.
//
// Die latestPosts werden in PR 5 fuer die Vision-Analyse der Brand-DNA
// gebraucht (Lighting, Scene, Camera-Style aus echten Reel-Covers
// ableiten). In PR 4 reichen die Profil-Felder.

export type InstagramProfilePost = {
  caption: string;
  displayUrl: string | null;
  videoUrl: string | null;
  type: string | null;
  hashtags: string[];
};

export type InstagramProfile = {
  username: string;
  fullName: string | null;
  biography: string;
  followersCount: number | null;
  followsCount: number | null;
  postsCount: number | null;
  profilePicUrl: string | null;
  profilePicUrlHD: string | null;
  externalUrl: string | null;
  isPrivate: boolean;
  isVerified: boolean;
  /** Die letzten N Posts mit Caption + Bild-URL. Maximal so viele, wie der
   *  Apify-Actor in dem details-Call mit liefert (typisch 12). */
  latestPosts: InstagramProfilePost[];
};

export async function scrapeInstagramProfile(
  rawHandle: string
): Promise<InstagramProfile> {
  const apiToken = process.env.APIFY_TOKEN;
  if (!apiToken) {
    throw new ApifyError("APIFY_TOKEN ist nicht gesetzt");
  }

  const username = rawHandle.replace(/^@+/, "").trim();
  if (!username || !/^[A-Za-z0-9._]+$/.test(username)) {
    throw new ApifyError(
      "Das ist kein gueltiger Instagram-Handle. Erwartet: bienesfitlife oder @bienesfitlife (Buchstaben, Zahlen, Punkte, Unterstriche)."
    );
  }

  const profileUrl = `https://www.instagram.com/${username}/`;
  const endpoint = `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${apiToken}&format=json`;

  // Input-Schema mit resultsType: "details" — der Actor liefert dann
  // Profil-Metadaten + ein latestPosts-Array. resultsLimit cappt die Posts
  // (nicht das Profile selbst), 12 deckt PR-5-Vision-Analyse mit Headroom.
  const body = {
    directUrls: [profileUrl],
    resultsType: "details",
    resultsLimit: 12,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    const isAbort = (err as Error).name === "AbortError";
    throw new ApifyError(
      isAbort
        ? "Apify-Cold-Start dauert gerade laenger als ueblich. Klick nochmal auf 'Aus Instagram laden' — der zweite Versuch geht meist in 5-10 Sekunden durch."
        : `Netzwerk-Fehler: ${(err as Error).message}`
    );
  }
  clearTimeout(timeout);

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    if (res.status === 401) {
      throw new ApifyError("Apify-Token ungueltig oder abgelaufen.", 401, errText);
    }
    if (res.status === 402) {
      throw new ApifyError(
        "Apify-Limit erreicht. Bitte spaeter erneut versuchen oder Free-Tier upgraden.",
        402,
        errText
      );
    }
    throw new ApifyError(
      `Apify-Fehler ${res.status}: ${errText.slice(0, 300)}`,
      res.status,
      errText
    );
  }

  const items = (await res.json()) as Array<{
    username?: string;
    fullName?: string;
    biography?: string;
    followersCount?: number;
    followsCount?: number;
    postsCount?: number;
    profilePicUrl?: string;
    profilePicUrlHD?: string;
    externalUrl?: string;
    private?: boolean;
    verified?: boolean;
    latestPosts?: Array<{
      caption?: string;
      displayUrl?: string;
      videoUrl?: string;
      type?: string;
      hashtags?: string[];
    }>;
    error?: string;
    errorDescription?: string;
  }>;

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApifyError(
      "Apify hat keinen Profil-Datensatz zurueckgeliefert. Eventuell ist das Profil privat oder der Handle stimmt nicht."
    );
  }

  const item = items[0];
  if (item.error || item.errorDescription) {
    throw new ApifyError(
      item.errorDescription ?? item.error ?? "Profil nicht erreichbar."
    );
  }

  if (!item.username) {
    throw new ApifyError(
      "Apify lieferte ein Item ohne Username — eventuell hat Instagram die Profil-Seite umstrukturiert."
    );
  }

  return {
    username: item.username,
    fullName: item.fullName ?? null,
    biography: (item.biography ?? "").trim(),
    followersCount:
      typeof item.followersCount === "number" ? item.followersCount : null,
    followsCount:
      typeof item.followsCount === "number" ? item.followsCount : null,
    postsCount: typeof item.postsCount === "number" ? item.postsCount : null,
    profilePicUrl: item.profilePicUrl ?? null,
    profilePicUrlHD: item.profilePicUrlHD ?? item.profilePicUrl ?? null,
    externalUrl: item.externalUrl ?? null,
    isPrivate: Boolean(item.private),
    isVerified: Boolean(item.verified),
    latestPosts: (item.latestPosts ?? [])
      .filter((p) => p && (p.caption || p.displayUrl))
      .slice(0, 12)
      .map((p) => ({
        caption: (p.caption ?? "").trim(),
        displayUrl: p.displayUrl ?? null,
        videoUrl: p.videoUrl ?? null,
        type: p.type ?? null,
        hashtags: p.hashtags ?? [],
      })),
  };
}

export async function scrapeInstagramPost(
  url: string
): Promise<InstagramPost> {
  const apiToken = process.env.APIFY_TOKEN;
  if (!apiToken) {
    throw new ApifyError("APIFY_TOKEN ist nicht gesetzt");
  }

  const normalized = normalizeInstagramUrl(url);
  if (!normalized) {
    throw new ApifyError(
      "Das ist keine gültige Instagram-URL. Erwartet: instagram.com/p/... oder /reel/..."
    );
  }

  // run-sync-get-dataset-items: startet den Actor, blockiert bis fertig,
  // liefert das Dataset direkt im Response-Body. Timeout serverseitig 5 min,
  // wir cappen client-seitig auf 45 s (Vercel-Lambda-Limit ist 60 s).
  const endpoint = `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${apiToken}&format=json`;

  // Input-Schema des "instagram-scraper":
  // - directUrls: Array von Post-/Reel-URLs (genau das, was wir liefern)
  // - resultsType: "posts" → wir wollen die Post-Daten incl. caption
  // - resultsLimit: 1 → wir scrapen nur einen einzigen Post pro Aufruf
  const body = {
    directUrls: [normalized],
    resultsType: "posts",
    resultsLimit: 1,
  };

  // Timeout: 55 s. Apify-Actors haben Cold-Starts, die bis zu ~45 s dauern
  // können. Vercel-Lambda-Limit liegt bei 60 s, also lassen wir uns 55 s
  // geben und 5 s Puffer für Gemini-Parsing + Response-Marshalling.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    const isAbort = (err as Error).name === "AbortError";
    throw new ApifyError(
      isAbort
        ? "Apify-Cold-Start dauert gerade länger als üblich. Klick einfach nochmal auf 'Rezept importieren' — der zweite Versuch geht meist in 5-10 Sekunden durch."
        : `Netzwerk-Fehler: ${(err as Error).message}`
    );
  }
  clearTimeout(timeout);

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    // 401 = Token ungueltig, 402 = Free-Tier ausgereizt, 404 = Actor nicht
    // gefunden (der Actor-Slug hat sich geaendert). Klare Meldung pro Fall.
    if (res.status === 401) {
      throw new ApifyError(
        "Apify-Token ungueltig oder abgelaufen.",
        401,
        errText
      );
    }
    if (res.status === 402) {
      throw new ApifyError(
        "Apify-Limit erreicht. Bitte später erneut versuchen oder Free-Tier upgraden.",
        402,
        errText
      );
    }
    throw new ApifyError(
      `Apify-Fehler ${res.status}: ${errText.slice(0, 300)}`,
      res.status,
      errText
    );
  }

  const items = (await res.json()) as Array<{
    caption?: string;
    displayUrl?: string;
    videoUrl?: string;
    videoDuration?: number;
    url?: string;
    ownerUsername?: string;
    hashtags?: string[];
    type?: string;
    error?: string;
    errorDescription?: string;
  }>;

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApifyError(
      "Apify hat keinen Post zurückgeliefert. Eventuell ist der Post privat oder gelöscht."
    );
  }

  const item = items[0];

  // Apify gibt bei privaten / gelöschten Posts oft ein Item mit error-Feld
  // zurück statt eines HTTP-Errors.
  if (item.error || item.errorDescription) {
    throw new ApifyError(
      item.errorDescription ?? item.error ?? "Post nicht erreichbar."
    );
  }

  if (!item.caption || item.caption.trim().length < 20) {
    throw new ApifyError(
      "Dieser Post hat keine ausreichende Beschreibung. Schau, ob du einen Reel oder Post mit ausgeschriebenem Rezept findest."
    );
  }

  return {
    caption: item.caption.trim(),
    displayUrl: item.displayUrl ?? null,
    videoUrl: item.videoUrl ?? null,
    videoDuration:
      typeof item.videoDuration === "number" ? item.videoDuration : null,
    postUrl: item.url ?? normalized,
    ownerUsername: item.ownerUsername ?? null,
    hashtags: item.hashtags ?? [],
    type: item.type ?? null,
  };
}
