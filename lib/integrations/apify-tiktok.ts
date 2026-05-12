// Apify-Client fuer TikTok-Profil-, Post- und Backfill-Scraping. Wir
// nutzen `clockworks~tiktok-scraper` (siehe https://apify.com/clockworks/tiktok-scraper)
// — der Standard-Apify-Actor fuer TikTok mit dem besten Schema-Mapping
// fuer unsere Recipe-Pipeline.
//
// Mirror-Design zum Instagram-Wrapper (lib/integrations/apify.ts):
//   - scrapeTikTokProfile(handle)  ←→ scrapeInstagramProfile(handle)
//   - scrapeTikTokPost(url)        ←→ scrapeInstagramPost(url)
//   - startTikTokBackfill()        ←→ startReelBackfill()
//   - fetchTikTokDataset()         ←→ fetchApifyDataset()
//
// Wo Schemas unterschiedlich sind, mappen wir auf die gleichen TypeScript-
// Typen (InstagramProfile / InstagramPost / BackfillReel), damit die
// downstream-Pipeline (Audience-Analyse, Recipe-Parser, Klassifikator)
// nicht wissen muss, woher die Daten kommen. Plattform-Info reist
// separat als `platform: SocialPlatform`.

import {
  ApifyError,
  type BackfillReel,
  type InstagramPost,
  type InstagramProfile,
  type InstagramProfilePost,
} from "@/lib/integrations/apify";

const APIFY_BASE = "https://api.apify.com/v2";
const TIKTOK_ACTOR_ID = "clockworks~tiktok-scraper";

// ─── URL-Normalisierung ────────────────────────────────────────────────────
// Akzeptiert die Hauptformate:
//   https://www.tiktok.com/@username/video/VIDEO_ID
//   https://www.tiktok.com/@username/video/VIDEO_ID?is_from_webapp=...
//   https://vm.tiktok.com/SHORTCODE/    (Shortlinks)
//   https://vt.tiktok.com/SHORTCODE/    (Mobile-Shortlinks)
//   https://m.tiktok.com/v/VIDEO_ID.html
// Output: kanonische https://www.tiktok.com/@username/video/VIDEO_ID
// Bei Shortlinks koennen wir die Video-ID nicht ohne HTTP-Redirect-Follow
// extrahieren — wir geben die Shortlink-URL als-is zurueck und lassen
// Apify den Redirect folgen.
export function normalizeTikTokUrl(raw: string): string | null {
  if (!raw) return null;
  let url = raw.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

  // Shortlinks → direkt zurueck, Apify folgt dem Redirect.
  if (host === "vm.tiktok.com" || host === "vt.tiktok.com") {
    return `https://${host}${parsed.pathname}`;
  }

  if (host !== "tiktok.com" && host !== "m.tiktok.com") {
    return null;
  }

  // Pfad-Patterns:
  //   /@username/video/VIDEO_ID         (Standard)
  //   /v/VIDEO_ID.html                  (Mobile)
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length >= 3 && segments[0].startsWith("@") && segments[1] === "video") {
    const username = segments[0];
    const videoId = segments[2].replace(/\.html$/, "");
    if (!/^\d+$/.test(videoId)) return null;
    return `https://www.tiktok.com/${username}/video/${videoId}`;
  }
  if (segments.length >= 2 && segments[0] === "v") {
    const videoId = segments[1].replace(/\.html$/, "");
    if (!/^\d+$/.test(videoId)) return null;
    return `https://www.tiktok.com/v/${videoId}.html`;
  }
  return null;
}

// ─── Profile-Scraping ──────────────────────────────────────────────────────
// Output-Mapping: clockworks~tiktok-scraper liefert kein dediziertes
// Profile-Objekt — wir lesen `authorMeta` aus dem ersten gescrapten Post
// und mappen ihn auf den InstagramProfile-Shape, damit die downstream-
// Identity-Analyse (analyzeCreatorIdentity) ohne Platform-Knowledge laeuft.

type TikTokAuthorMeta = {
  name?: string;
  nickName?: string;
  signature?: string;
  fans?: number;
  following?: number;
  heart?: number;
  video?: number;
  avatar?: string;
  verified?: boolean;
  privateAccount?: boolean;
};

type TikTokItemRaw = {
  id?: string;
  text?: string;
  webVideoUrl?: string;
  videoUrl?: string;
  createTimeISO?: string;
  playCount?: number;
  diggCount?: number;
  commentCount?: number;
  shareCount?: number;
  hashtags?: Array<{ name?: string } | string>;
  videoMeta?: {
    coverUrl?: string;
    duration?: number;
  };
  authorMeta?: TikTokAuthorMeta;
  error?: string;
  errorDescription?: string;
  [k: string]: unknown;
};

export async function scrapeTikTokProfile(
  rawHandle: string
): Promise<InstagramProfile> {
  const apiToken = process.env.APIFY_TOKEN;
  if (!apiToken) {
    throw new ApifyError("APIFY_TOKEN ist nicht gesetzt");
  }
  const username = rawHandle.replace(/^@+/, "").trim();
  if (!username || !/^[A-Za-z0-9._]+$/.test(username)) {
    throw new ApifyError(
      "Das ist kein gültiger TikTok-Handle. Erwartet: bienesfitlife oder @bienesfitlife."
    );
  }

  const endpoint = `${APIFY_BASE}/acts/${TIKTOK_ACTOR_ID}/run-sync-get-dataset-items?token=${apiToken}&format=json`;
  // resultsPerPage=30: gleiche Menge wie Instagram, damit Vision-Analyse +
  // Audience-Analyzer eine vergleichbare Caption-Basis haben.
  // shouldDownloadVideos=false: wir wollen nur Metadaten, keine MP4s.
  const body = {
    profiles: [username],
    resultsPerPage: 30,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    proxyCountryCode: "None",
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
        ? "Apify-Cold-Start bei TikTok dauert gerade länger. Klick nochmal — der zweite Versuch geht meist in 5-10 Sekunden durch."
        : `Netzwerk-Fehler: ${(err as Error).message}`
    );
  }
  clearTimeout(timeout);

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    if (res.status === 401) {
      throw new ApifyError("Apify-Token ungültig oder abgelaufen.", 401, errText);
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

  const items = (await res.json()) as TikTokItemRaw[];
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApifyError(
      "TikTok-Apify hat keinen Datensatz zurückgeliefert. Eventuell hat der Account noch keine Posts, ist privat, oder der Handle stimmt nicht."
    );
  }

  // Author-Meta aus dem ersten Post — ist auf allen Posts identisch.
  const first = items[0];
  if (first.error || first.errorDescription) {
    throw new ApifyError(
      first.errorDescription ?? first.error ?? "TikTok-Profil nicht erreichbar."
    );
  }
  const author = first.authorMeta ?? {};
  if (!author.name) {
    throw new ApifyError(
      "TikTok hat keinen Author-Datensatz mitgeliefert — vermutlich Schema-Aenderung beim Scraper. Bitte manuell befuellen."
    );
  }

  const latestPosts: InstagramProfilePost[] = items
    .filter((it) => it && (it.text || it.videoMeta?.coverUrl))
    .slice(0, 30)
    .map((it) => ({
      caption: (it.text ?? "").trim(),
      displayUrl: it.videoMeta?.coverUrl ?? null,
      videoUrl: it.videoUrl ?? null,
      // TikTok-Posts sind quasi alle Videos — wir markieren das fuer die
      // Downstream-Pipeline (Hero-Generator nutzt das, um Video-Keyframe-
      // Extraction zu triggern). 'Video' matched dem Instagram-Reel-Naming.
      type: "Video",
      hashtags: Array.isArray(it.hashtags)
        ? it.hashtags
            .map((h) =>
              typeof h === "string" ? h : h && typeof h.name === "string" ? h.name : null
            )
            .filter((h): h is string => Boolean(h))
        : [],
    }));

  return {
    username: author.name,
    fullName: author.nickName ?? null,
    biography: (author.signature ?? "").trim(),
    followersCount: typeof author.fans === "number" ? author.fans : null,
    followsCount: typeof author.following === "number" ? author.following : null,
    postsCount: typeof author.video === "number" ? author.video : null,
    profilePicUrl: author.avatar ?? null,
    profilePicUrlHD: author.avatar ?? null,
    externalUrl: null,
    isPrivate: Boolean(author.privateAccount),
    isVerified: Boolean(author.verified),
    latestPosts,
  };
}

// ─── Post-Scraping fuer Recipe-Import ──────────────────────────────────────
// Single-Post-Scrape — vom Recipe-Import-Form genutzt, wenn der User
// einen TikTok-Link einwirft. Output-Shape matched InstagramPost, damit
// `parseRecipeFromCaption` ohne Plattform-Knowledge laeuft.

export async function scrapeTikTokPost(rawUrl: string): Promise<InstagramPost> {
  const apiToken = process.env.APIFY_TOKEN;
  if (!apiToken) {
    throw new ApifyError("APIFY_TOKEN ist nicht gesetzt");
  }
  const normalized = normalizeTikTokUrl(rawUrl);
  if (!normalized) {
    throw new ApifyError(
      "Das ist keine gültige TikTok-URL. Erwartet: tiktok.com/@user/video/... oder vm.tiktok.com/..."
    );
  }

  const endpoint = `${APIFY_BASE}/acts/${TIKTOK_ACTOR_ID}/run-sync-get-dataset-items?token=${apiToken}&format=json`;
  const body = {
    postURLs: [normalized],
    resultsPerPage: 1,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    proxyCountryCode: "None",
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
        ? "TikTok-Apify-Cold-Start dauert gerade laenger. Klick nochmal — zweiter Versuch ist meist deutlich schneller."
        : `Netzwerk-Fehler: ${(err as Error).message}`
    );
  }
  clearTimeout(timeout);

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    if (res.status === 401) {
      throw new ApifyError("Apify-Token ungültig oder abgelaufen.", 401, errText);
    }
    if (res.status === 402) {
      throw new ApifyError(
        "Apify-Limit erreicht.",
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

  const items = (await res.json()) as TikTokItemRaw[];
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApifyError(
      "Apify hat keinen TikTok-Post zurückgeliefert. Eventuell ist der Post privat oder gelöscht."
    );
  }
  const item = items[0];
  if (item.error || item.errorDescription) {
    throw new ApifyError(
      item.errorDescription ?? item.error ?? "TikTok-Post nicht erreichbar."
    );
  }
  const caption = (item.text ?? "").trim();
  if (!caption || caption.length < 20) {
    throw new ApifyError(
      "Dieser TikTok-Post hat keine ausreichende Beschreibung — für ein Rezept braucht's Zutaten + Schritte in der Caption. Schau nach einem Video mit ausgeschriebenem Rezept."
    );
  }

  return {
    caption,
    displayUrl: item.videoMeta?.coverUrl ?? null,
    videoUrl: item.videoUrl ?? null,
    videoDuration:
      typeof item.videoMeta?.duration === "number" ? item.videoMeta.duration : null,
    postUrl: item.webVideoUrl ?? normalized,
    ownerUsername: item.authorMeta?.name ?? null,
    hashtags: Array.isArray(item.hashtags)
      ? item.hashtags
          .map((h) =>
            typeof h === "string" ? h : h && typeof h.name === "string" ? h.name : null
          )
          .filter((h): h is string => Boolean(h))
      : [],
    type: "Video",
  };
}

// ─── Async-Backfill fuer Reel-Library ──────────────────────────────────────
// Startet einen async Apify-Run mit Webhook (gleicher Endpoint wie der
// Instagram-Backfill). Webhook matched die `apify_run_id` zur
// creator_scrapes-Tabelle und holt das Dataset ueber fetchTikTokDataset().

export async function startTikTokBackfill(opts: {
  username: string;
  webhookUrl: string;
  resultsLimit?: number;
  onlyPostsNewerThanDays?: number;
}): Promise<{ runId: string; datasetId: string }> {
  const apiToken = process.env.APIFY_TOKEN;
  if (!apiToken) {
    throw new ApifyError("APIFY_TOKEN ist nicht gesetzt");
  }
  const username = opts.username.replace(/^@+/, "").trim();
  if (!username || !/^[A-Za-z0-9._]+$/.test(username)) {
    throw new ApifyError("Kein gültiger TikTok-Handle für den Backfill.");
  }

  const endpoint = `${APIFY_BASE}/acts/${TIKTOK_ACTOR_ID}/runs?token=${apiToken}`;
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
  const webhooksBase64 = Buffer.from(JSON.stringify(webhooks)).toString("base64");

  // oldestPostDateUnified als "X days"-String — clockworks akzeptiert das.
  // Default 200 Posts / 365 Tage (Cost-Optimierung Mai 2026 — vorher 500/730).
  const body = {
    profiles: [username],
    resultsPerPage: opts.resultsLimit ?? 200,
    oldestPostDateUnified: `${opts.onlyPostsNewerThanDays ?? 365} days`,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    proxyCountryCode: "None",
  };

  const res = await fetch(`${endpoint}&webhooks=${webhooksBase64}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new ApifyError(
      `TikTok-Apify-Run konnte nicht gestartet werden (${res.status}): ${errText.slice(0, 300)}`,
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
      "TikTok-Apify-Run-Response unvollstaendig — keine runId/datasetId."
    );
  }
  return { runId, datasetId };
}

// Holt das Dataset eines fertigen TikTok-Backfill-Runs. Wird vom Webhook
// aufgerufen — wir extrahieren TikTok-spezifische Felder und mappen sie
// auf den shared BackfillReel-Shape.
export async function fetchTikTokDataset(
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
      `TikTok-Apify-Dataset konnte nicht geladen werden (${res.status}): ${errText.slice(0, 300)}`,
      res.status,
      errText
    );
  }

  const items = (await res.json()) as TikTokItemRaw[];
  if (!Array.isArray(items)) {
    throw new ApifyError(
      "TikTok-Apify-Dataset hat kein Array zurueckgeliefert."
    );
  }

  return items
    .filter((item) => item.id && item.webVideoUrl)
    .map<BackfillReel>((item) => ({
      // Video-ID als stabiler Identifier — wird in creator_reels.ig_id
      // gespeichert (Column-Name bleibt aus Backward-Compat, semantisch
      // ist es "platform-external-id").
      igId: String(item.id),
      postUrl: item.webVideoUrl as string,
      type: "Video",
      caption: (item.text ?? "").trim(),
      displayUrl: item.videoMeta?.coverUrl ?? null,
      videoUrl: item.videoUrl ?? null,
      postedAt: item.createTimeISO ?? null,
      likeCount:
        typeof item.diggCount === "number" ? item.diggCount : null,
      viewCount:
        typeof item.playCount === "number" ? item.playCount : null,
      commentCount:
        typeof item.commentCount === "number" ? item.commentCount : null,
      hashtags: Array.isArray(item.hashtags)
        ? item.hashtags
            .map((h) =>
              typeof h === "string" ? h : h && typeof h.name === "string" ? h.name : null
            )
            .filter((h): h is string => Boolean(h))
        : [],
      raw: item,
    }));
}

// Quick-Scrape (synchron) fuer den Auto-Pack-Tab — analog quickScrapeReels
// fuer Instagram. Klein dimensioniert (~30 Reels, 30 Tage Filter), passt
// in run-sync (~25s).
export async function quickScrapeTikTokReels(opts: {
  username: string;
  resultsLimit?: number;
  onlyPostsNewerThanDays?: number;
}): Promise<BackfillReel[]> {
  const apiToken = process.env.APIFY_TOKEN;
  if (!apiToken) {
    throw new ApifyError("APIFY_TOKEN ist nicht gesetzt");
  }
  const username = opts.username.replace(/^@+/, "").trim();
  if (!username || !/^[A-Za-z0-9._]+$/.test(username)) {
    throw new ApifyError("Kein gültiger TikTok-Handle.");
  }

  const endpoint = `${APIFY_BASE}/acts/${TIKTOK_ACTOR_ID}/run-sync-get-dataset-items?token=${apiToken}&format=json`;
  const body = {
    profiles: [username],
    resultsPerPage: opts.resultsLimit ?? 30,
    oldestPostDateUnified: `${opts.onlyPostsNewerThanDays ?? 30} days`,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    proxyCountryCode: "None",
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
        ? "TikTok-Quick-Scrape hat zu lange gebraucht. Bitte erneut versuchen."
        : `Netzwerk-Fehler: ${(err as Error).message}`
    );
  }
  clearTimeout(timeout);

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new ApifyError(
      `TikTok-Apify-Fehler ${res.status}: ${errText.slice(0, 300)}`,
      res.status,
      errText
    );
  }

  const items = (await res.json()) as TikTokItemRaw[];
  if (!Array.isArray(items)) {
    throw new ApifyError("TikTok-Apify lieferte kein Array.");
  }

  return items
    .filter((item) => item.id && item.webVideoUrl)
    .map<BackfillReel>((item) => ({
      igId: String(item.id),
      postUrl: item.webVideoUrl as string,
      type: "Video",
      caption: (item.text ?? "").trim(),
      displayUrl: item.videoMeta?.coverUrl ?? null,
      videoUrl: item.videoUrl ?? null,
      postedAt: item.createTimeISO ?? null,
      likeCount: typeof item.diggCount === "number" ? item.diggCount : null,
      viewCount: typeof item.playCount === "number" ? item.playCount : null,
      commentCount:
        typeof item.commentCount === "number" ? item.commentCount : null,
      hashtags: Array.isArray(item.hashtags)
        ? item.hashtags
            .map((h) =>
              typeof h === "string" ? h : h && typeof h.name === "string" ? h.name : null
            )
            .filter((h): h is string => Boolean(h))
        : [],
      raw: item,
    }));
}
