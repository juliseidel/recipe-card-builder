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
  // Profil-Metadaten + ein latestPosts-Array. resultsLimit auf 30 erweitert
  // (PR 7): bei Reels-fokussierten Creators sind viele Cover-displayUrls
  // Talking-Heads mit Werbe-Overlays. Mehr Posts erhoehen die Chance,
  // dass mindestens ein paar saubere Dish-Shots dabei sind ODER dass
  // genug Reels mit videoUrl da sind, aus denen ffmpeg saubere Hero-
  // Frames extrahieren kann.
  const body = {
    directUrls: [profileUrl],
    resultsType: "details",
    resultsLimit: 30,
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
      .slice(0, 30)
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

// ─── 2-Jahres-Backfill: asynchroner Apify-Run + Webhook ────────────────────
// Beim Onboarding holen wir die KOMPLETTE Reel-Library eines Creators
// (resultsLimit ~500). Das dauert 3-10 Min, deutlich mehr als Vercel-
// Lambda-Limits zulassen. Loesung:
//   1. Apify-Run async starten (POST /acts/.../runs, NICHT run-sync)
//   2. Apify ruft per Webhook unseren Endpoint auf, wenn der Run fertig ist
//   3. Wir laden das Dataset (separater API-Call) + persistieren in DB
//
// Webhook-Authentifizierung: der Webhook bekommt nichts schlimmes mit, falls
// jemand drauf draufpostet — wir matchen den apify_run_id gegen unsere
// creator_scrapes-Tabelle. Wer eine echte Run-ID raet, hat das Apify-System
// schon kompromittiert. Defense-in-depth: optionaler APIFY_WEBHOOK_SECRET
// als Query-Param.

export type BackfillReel = {
  /** IG-Shortcode aus der Post-URL — Stable Identifier fuer Dedup. */
  igId: string;
  postUrl: string;
  /** 'Video' (Reel) / 'Image' / 'Sidecar' (Carousel). */
  type: string;
  caption: string;
  displayUrl: string | null;
  videoUrl: string | null;
  postedAt: string | null;          // ISO-8601 oder null
  likeCount: number | null;
  viewCount: number | null;         // nur bei Reels
  commentCount: number | null;
  hashtags: string[];
  /** Raw Apify-Item — fuer Replay/Debug behalten. */
  raw: unknown;
};

// Startet einen asynchronen Apify-Run fuer den 2-Jahres-Backfill und gibt
// die Run-ID zurueck. Apify rufen unseren Webhook auf, sobald der Run
// fertig ist (succeeded / failed / timed-out).
export async function startReelBackfill(opts: {
  username: string;
  /** Vollstaendige HTTPS-URL des Webhook-Endpoints. */
  webhookUrl: string;
  /** Wie viele Posts max? Standard: 500 (~2 Jahre bei aktiven Creators).
   *  Fuer Daily-Refresh setzt der Cron-Job das auf 30-50 runter. */
  resultsLimit?: number;
  /** Wie weit zurueck scrapen? Standard 730 (2 Jahre). Cron-Refresh setzt
   *  das auf 30 — wir brauchen nur neue Posts seit dem letzten Lauf. */
  onlyPostsNewerThanDays?: number;
}): Promise<{ runId: string; datasetId: string }> {
  const apiToken = process.env.APIFY_TOKEN;
  if (!apiToken) {
    throw new ApifyError("APIFY_TOKEN ist nicht gesetzt");
  }

  const username = opts.username.replace(/^@+/, "").trim();
  if (!username || !/^[A-Za-z0-9._]+$/.test(username)) {
    throw new ApifyError(
      "Kein gueltiger Instagram-Handle fuer den Backfill."
    );
  }

  const profileUrl = `https://www.instagram.com/${username}/`;
  const endpoint = `${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${apiToken}`;

  // Apify-Webhook-Subscription. Bei SUCCEEDED haben wir das Dataset und
  // koennen die Reels einlesen. FAILED/TIMED_OUT/ABORTED markieren wir den
  // Scrape als 'failed' und zeigen dem User eine Hinweismeldung.
  //
  // payloadTemplate: Apify-Default-Payload mit allen Standard-Feldern. Wir
  // erweitern eigentlich nichts, das default-Payload enthaelt schon
  // resource.id (runId) + resource.defaultDatasetId — alles was wir
  // brauchen.
  const webhooks = [
    {
      eventTypes: [
        "ACTOR.RUN.SUCCEEDED",
        "ACTOR.RUN.FAILED",
        "ACTOR.RUN.TIMED_OUT",
        "ACTOR.RUN.ABORTED",
      ],
      requestUrl: opts.webhookUrl,
    },
  ];

  // Base64-encode der Webhook-Konfiguration (Apify-Format fuer
  // ?webhooks=... Query-Param bei runs-Endpoint).
  const webhooksBase64 = Buffer.from(JSON.stringify(webhooks)).toString(
    "base64"
  );

  const body = {
    directUrls: [profileUrl],
    // "posts" liefert alle Post-Typen (Reel, Image, Sidecar) inkl. der
    // wichtigen `timestamp` + `videoUrl`-Felder. "details" wuerde nur
    // Profil-Metadaten + ~30 latestPosts liefern.
    resultsType: "posts",
    resultsLimit: opts.resultsLimit ?? 500,
    // onlyPostsNewerThan ist als String-Filter erlaubt ("2 years", "30 days"),
    // limitiert serverseitig den Apify-Run.
    onlyPostsNewerThan: `${opts.onlyPostsNewerThanDays ?? 730} days`,
  };

  const res = await fetch(`${endpoint}&webhooks=${webhooksBase64}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new ApifyError(
      `Apify-Run konnte nicht gestartet werden (${res.status}): ${errText.slice(0, 300)}`,
      res.status,
      errText
    );
  }

  const json = (await res.json()) as {
    data?: { id?: string; defaultDatasetId?: string };
  };
  const runId = json.data?.id;
  const datasetId = json.data?.defaultDatasetId;
  if (!runId || !datasetId) {
    throw new ApifyError(
      "Apify-Run-Response unvollstaendig — keine runId/datasetId."
    );
  }
  return { runId, datasetId };
}

// Holt das Dataset eines bereits-fertigen Apify-Runs. Wird vom Webhook-
// Handler aufgerufen, nachdem Apify uns "SUCCEEDED" signalisiert hat.
// limit=1000 ist ueppig (Apify selbst limitiert auf 500), reicht fuer
// einen vollen Backfill in einem Request.
export async function fetchApifyDataset(
  datasetId: string
): Promise<BackfillReel[]> {
  const apiToken = process.env.APIFY_TOKEN;
  if (!apiToken) {
    throw new ApifyError("APIFY_TOKEN ist nicht gesetzt");
  }

  const endpoint = `${APIFY_BASE}/datasets/${datasetId}/items?token=${apiToken}&format=json&clean=true&limit=1000`;
  const res = await fetch(endpoint);
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new ApifyError(
      `Apify-Dataset konnte nicht geladen werden (${res.status}): ${errText.slice(0, 300)}`,
      res.status,
      errText
    );
  }

  const items = (await res.json()) as Array<{
    shortCode?: string;
    url?: string;
    type?: string;
    caption?: string;
    displayUrl?: string;
    videoUrl?: string;
    timestamp?: string;
    likesCount?: number;
    videoViewCount?: number;
    videoPlayCount?: number;
    commentsCount?: number;
    hashtags?: string[];
    [k: string]: unknown;
  }>;

  if (!Array.isArray(items)) {
    throw new ApifyError(
      "Apify-Dataset hat kein Array zurueckgeliefert."
    );
  }

  return items
    .filter((item) => item.shortCode && item.url)
    .map((item) => ({
      igId: item.shortCode as string,
      postUrl: item.url as string,
      type: item.type ?? "Image",
      caption: (item.caption ?? "").trim(),
      displayUrl: item.displayUrl ?? null,
      videoUrl: item.videoUrl ?? null,
      postedAt: item.timestamp ?? null,
      likeCount: typeof item.likesCount === "number" ? item.likesCount : null,
      // Reels haben videoViewCount; bei aelteren Reels videoPlayCount.
      viewCount:
        typeof item.videoViewCount === "number"
          ? item.videoViewCount
          : typeof item.videoPlayCount === "number"
            ? item.videoPlayCount
            : null,
      commentCount:
        typeof item.commentsCount === "number" ? item.commentsCount : null,
      hashtags: Array.isArray(item.hashtags) ? item.hashtags : [],
      raw: item,
    }));
}

// Holt den Status eines Apify-Runs direkt — Fallback falls der Webhook
// nicht ankommt (z.B. Vercel-Cold-Start hat den Webhook-Request gemissed).
// Wird vom Library-Status-Endpoint als Recovery-Pfad genutzt.
export async function getApifyRunStatus(
  runId: string
): Promise<{ status: string; defaultDatasetId: string | null }> {
  const apiToken = process.env.APIFY_TOKEN;
  if (!apiToken) {
    throw new ApifyError("APIFY_TOKEN ist nicht gesetzt");
  }
  const endpoint = `${APIFY_BASE}/actor-runs/${runId}?token=${apiToken}`;
  const res = await fetch(endpoint);
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new ApifyError(
      `Apify-Run-Status nicht abrufbar (${res.status}): ${errText.slice(0, 200)}`,
      res.status,
      errText
    );
  }
  const json = (await res.json()) as {
    data?: { status?: string; defaultDatasetId?: string };
  };
  return {
    status: json.data?.status ?? "UNKNOWN",
    defaultDatasetId: json.data?.defaultDatasetId ?? null,
  };
}
