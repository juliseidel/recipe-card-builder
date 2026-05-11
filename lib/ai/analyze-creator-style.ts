import sharp from "sharp";
import { callGeminiMultimodal } from "./gemini";
import { extractVideoFrames } from "./extract-video-frames";
import type { BrandImageStyleOverride } from "@/lib/brands";
import type { InstagramProfilePost } from "@/lib/integrations/apify";

// Brand-DNA-Analyzer fuer das Creator-Onboarding (PR 5). Schaut sich die
// letzten 6-8 Reel-Covers / Post-Bilder des Creators an und leitet daraus
// die Image-Pipeline-DNA ab — analog zu Bienes hand-kalibriertem
// BIENE_STYLE in lib/ai/brand-image-style.ts.
//
// Ziel: jeder neue Creator bekommt einen individuellen Style ohne
// stundenlange Hand-Tuning-Iterationen, die wir mit Biene durchgemacht
// haben. Vision-Analyse macht es in ~20-30 Sekunden.
//
// Modell: Gemini 2.5 Pro multimodal (NICHT Flash) — Pro hat deutlich
// besseres Bild-Verstaendnis fuer Detail-Capture, Farb-Nuancen und
// raeumliche Anordnung. Das ist der einzige Vision-Call im Tool, wo wir
// uns die ~3x Latenz von Pro leisten — die DNA wird nur einmal pro
// Creator generiert.

// PR 10: responseSchema komplett entfernt. Bisheriger Schema-Validator
// hat trotz Flattening + Compression weiterhin 400 INVALID_ARGUMENT
// geworfen. Wir lassen Gemini Text/JSON returnen, parsen post-process.
// Schema-Anweisungen leben nur noch im System-Prompt.
//
// Gemini-Response hat flache angle-Felder; wir bauen das original
// defaultAngles-Objekt im normalisierten Output wieder zusammen.
type RawStyleResponse = Omit<
  BrandImageStyleOverride,
  "defaultAngles"
> & {
  angleFlat?: string;
  angleLayered?: string;
  angleTall?: string;
  angleLiquid?: string;
  angleMixed?: string;
};

const SYSTEM_INSTRUCTION = `Du analysierst Food-Photography-Reel-Covers eines Instagram-Creators und leitest daraus die Image-Pipeline-DNA ab. Ziel: ein KI-Bild-Generierungs-System (Flux 2 Pro) soll den visuellen Stil dieses Creators reproduzieren koennen.

WICHTIG VORWEG: Manche Bilder sind Reel-Cover mit Werbe-Overlays, Talking-Head-Frames oder Branding-Sticker. IGNORIERE diese komplett. Konzentriere dich nur auf die Bilder, in denen das fertig angerichtete Gericht klar zu sehen ist (Bowl/Plate/Pan). Wenn nur 2-3 Bilder sauberes Gericht zeigen, reicht das — analysiere DIESE.

Aus den sauberen Dish-Bildern erkennst du Muster:

1. **Lighting** (5 Strings): Welche Richtungen, Intensitaeten, Farb-Temperaturen? Bevorzuge ENGLISCHE Praezisions-Phrasen wie:
   - 'bright natural daylight from above with soft even illumination'
   - 'warm morning light streaming from the left with soft shadows'
   - 'cool clean daylight from a window, neutral white balance, modern feel'

2. **Surface/Scene** (5 Strings): Was sieht der Counter aus? SEHR wichtig — das prägt den Look am staerksten. Erkenne klar:
   - 'a clean pale-grey concrete kitchen counter' (Bienes Look)
   - 'a smooth cream-colored matte countertop' (modern minimal — bei vielen FitFood-Creators)
   - 'a white marble surface with subtle veining'
   - 'a warm walnut wooden cutting board'
   - 'a soft linen runner over a pale stone counter'
   FRAGE DICH EXPLIZIT: ist es eher MODERN/MINIMAL (helle Counter, clean) oder RUSTIC/COOKBOOK (Holz, dunkel, props)? Beschreibe was du WIRKLICH siehst.

3. **Camera-Aesthetic**: Pick eine der beiden Familien:
   - 'natural unstaged food photograph, modern minimal styling, homemade-feeling, no studio look' (fuer clean modern Creator)
   - 'cookbook-style food photograph with intentional styling and props' (fuer rustic Creator)

4. **Hero-Element**: Wo + wie platziert der Creator Garnish oder Hero-Zutat? Im Hintergrund auf separatem Brett? Auf dem Gericht selbst? Daneben? Wenn KEIN konsistentes Hero-Element erkennbar: 'Keep styling minimal — the dish is the hero. Optionally a small neutral linen napkin or a single ingredient placed loosely beside the bowl/plate.'

5. **Angles**: Pro DishShape entscheiden — top-down (80°) bei flat/mixed wenn Creator overhead-shoot't (haeufig bei modernen Food-Creators), three-quarter (30°) bei layered/liquid. Wenn der Creator GANZ KLAR alles top-down macht: gib top-down fuer alle 5 Shapes.

6. **Anti-Patterns** (negativeAddition): Was sieht man NIE? z.B. 'no rustic wooden table, no dark vintage props, no heavy cookbook styling' wenn der Creator modern shoot't. Oder 'no parsley, no cast-iron pan' wenn klar erkennbar.

REGELN:
- Alle Strings auf ENGLISCH (Flux versteht nur Englisch).
- Sei SPEZIFISCH: nicht 'warm light', sondern 'warm morning light from the upper left with soft long shadows on a pale surface'.
- KEINE Halluzinationen: wenn unklar, lieber kuerzere/leere Werte als erfundene Details.
- Bevorzuge MODERN-MINIMAL Deskriptionen ueber Cookbook-Rustic, wenn die Bilder helle Counter zeigen — das ist der Default fuer heute aktive Creators.

Antworte AUSSCHLIESSLICH im JSON-Schema.`;

// Komprimiert ein Bild-Buffer auf max 768 px long-edge JPEG q=75. Bei
// Instagram-CDN-Bildern (typisch 1080p, ~250 KB) reduziert das die
// Base64-Payload um Faktor ~6-8. Wichtig fuer Gemini Pro Multimodal-
// Calls — 14+ Bilder bei voller Aufloesung knacken sonst das 20 MB
// inline-Payload-Limit und der Call kommt als 400 INVALID_ARGUMENT
// zurueck.
async function compressForVision(buf: Buffer): Promise<Buffer> {
  return sharp(buf)
    .resize(768, 768, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 75, mozjpeg: true })
    .toBuffer();
}

// Fetched die displayUrls (Instagram-CDN-Links) als Buffer und konvertiert
// zu base64 fuer den multimodal Gemini-Call. Parallel mit Promise.all —
// auch 8 Fetches sind in ~3-5s durch. PR 9: nach Fetch durch sharp
// komprimieren bevor base64 — sonst Gemini-400.
async function fetchImagesAsBase64(
  urls: string[]
): Promise<Array<{ base64: string; mime: string }>> {
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        },
      });
      if (!res.ok) {
        throw new Error(`Image fetch failed: ${res.status}`);
      }
      const raw = Buffer.from(await res.arrayBuffer());
      const compressed = await compressForVision(raw);
      return {
        base64: compressed.toString("base64"),
        mime: "image/jpeg",
      };
    })
  );
  return results
    .filter(
      (r): r is PromiseFulfilledResult<{ base64: string; mime: string }> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value);
}

// Reel-Frame-Mining (PR 7): Apify-displayUrls sind bei Reel-fokussierten
// Creators (wie Jule) oft Talking-Head-Cover mit Werbe-Overlays — keine
// brauchbaren Style-Signale. Die ECHTEN Hero-Bilder stecken im Video.
// Wir laden bis zu 4 Reel-Videos parallel, ffmpeg extrahiert 3 Frames im
// letzten Drittel (wo das fertige Dish meist gezeigt wird) und gibt sie
// als data:image/jpeg;base64-URIs zurueck — gleiches Format wie
// fetchImagesAsBase64. So bekommt der Pool an Gemini Pro neben den
// statischen Covers auch echte Dish-Shots aus den Reels.
//
// Cost-Faktor: ffmpeg ist gratis im Lambda, Video-Download ~1-3 MB
// pro Reel. Latenz: ~10-20s pro Reel, parallel ~15-25s total.
async function mineReelFrames(
  reelUrls: string[]
): Promise<Array<{ base64: string; mime: string }>> {
  const results = await Promise.allSettled(
    reelUrls.map(async (videoUrl) => {
      try {
        const frames = await extractVideoFrames(videoUrl, {
          intervalSeconds: 3,
          maxFrames: 3,
        });
        // Frames sind als data-URIs ("data:image/jpeg;base64,...") —
        // splitten, base64-decoden, mit sharp auf 768px komprimieren,
        // dann wieder base64-encoden fuer Gemini.
        return await Promise.all(
          frames.map(async (f) => {
            const [, base64Raw = ""] = f.dataUri.split(",");
            const raw = Buffer.from(base64Raw, "base64");
            const compressed = await compressForVision(raw);
            return {
              base64: compressed.toString("base64"),
              mime: "image/jpeg",
            };
          })
        );
      } catch (err) {
        console.warn(
          "[analyze-style] reel-frame extraction failed:",
          err instanceof Error ? err.message : err
        );
        return [];
      }
    })
  );
  return results
    .filter(
      (r): r is PromiseFulfilledResult<Array<{ base64: string; mime: string }>> =>
        r.status === "fulfilled"
    )
    .flatMap((r) => r.value);
}

export async function analyzeCreatorVisualStyle(
  posts: InstagramProfilePost[]
): Promise<BrandImageStyleOverride | null> {
  // Zwei-Quellen-Strategie (PR 7):
  //   A) statische displayUrls (Cover-Frames) — schnell aber oft Talking-
  //      Head/Werbe-Overlay bei Reels-fokussierten Creators
  //   B) ffmpeg-Frames aus den letzten Reels (videoUrl) — die ECHTEN
  //      Hero-Bilder im letzten Drittel des Videos
  //
  // Wir machen BEIDES parallel und mergen die Bilder in einem Pool. Gemini
  // Pro Vision pickt sich dann die saubersten Dish-Shots raus.

  // A) Cover-displayUrls — bis zu 6 verschiedene Posts (am liebsten
  //    Image/Sidecar-Typen, weil die meist saubere Dishes statt Reel-
  //    Covers sind)
  const imagePosts = posts.filter(
    (p) => p.displayUrl && (p.type === "Image" || p.type === "Sidecar")
  );
  const reelPosts = posts.filter(
    (p) => p.displayUrl && p.type === "Video"
  );
  // Image-Posts priorisieren, dann Reel-Cover als Fueller
  const coverUrls = [...imagePosts, ...reelPosts]
    .slice(0, 6)
    .map((p) => p.displayUrl as string);

  // B) Reel-videoUrls — bis zu 4 fuer ffmpeg-Frame-Mining (3 Frames each
  //    = max 12 echte Hero-Frames)
  const videoUrls = posts
    .filter((p) => p.videoUrl)
    .slice(0, 4)
    .map((p) => p.videoUrl as string);

  console.log(
    `[analyze-style] posts=${posts.length} | covers=${coverUrls.length} (img=${imagePosts.length} reel=${reelPosts.length}) | reel-videos=${videoUrls.length}`
  );

  if (coverUrls.length === 0 && videoUrls.length === 0) {
    console.warn(
      "[analyze-style] weder displayUrls noch videoUrls — ueberspringe Vision-Analyse"
    );
    return null;
  }

  // Parallel laden: Cover + Reel-Frames
  const t0 = Date.now();
  const [coverImages, reelFrames] = await Promise.all([
    coverUrls.length > 0
      ? fetchImagesAsBase64(coverUrls)
      : Promise.resolve([]),
    videoUrls.length > 0
      ? mineReelFrames(videoUrls)
      : Promise.resolve([]),
  ]);
  console.log(
    `[analyze-style] image-pool ready in ${Date.now() - t0}ms: ${coverImages.length} covers + ${reelFrames.length} reel-frames = ${coverImages.length + reelFrames.length} total`
  );

  // Cap auf 10 (PR 9: vorher 16, aber selbst nach Sharp-Komprimierung
  // konservativ — Gemini Pro hat zwar grossere Bild-Limits, aber bei
  // 10 Bildern à ~30-50 KB base64 ist die Payload klar unter dem
  // 20 MB inline-Limit). Reel-Frames zuerst — die zeigen meist das
  // fertige Dish, das ist das wichtigste Style-Signal.
  const images = [...reelFrames, ...coverImages].slice(0, 10);
  if (images.length < 2) {
    console.warn(
      `[analyze-style] zu wenige Bilder im Pool (${images.length}), ueberspringe Vision-Analyse`
    );
    return null;
  }
  const totalKb = Math.round(
    images.reduce((sum, i) => sum + i.base64.length, 0) / 1024
  );
  console.log(
    `[analyze-style] sending ${images.length} compressed images to Gemini Pro (~${totalKb}KB base64 total)`
  );

  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [
    {
      text: `Analysiere die folgenden ${images.length} Bilder eines Food-Creators und extrahiere die Image-Pipeline-DNA. Antworte im JSON-Schema.`,
    },
  ];
  for (const img of images) {
    parts.push({
      inlineData: { mimeType: img.mime, data: img.base64 },
    });
  }

  const tVision = Date.now();
  let raw: RawStyleResponse;
  try {
    // PR 10: Schema komplett raus — Gemini's responseSchema-Validator
    // hat mit multiple Konfigurationen 400 INVALID_ARGUMENT geworfen
    // (auch nach Schema-Flattening in PR 9). Wir lassen Gemini Text
    // returnen mit klarem JSON-Output-Auftrag im System-Prompt und
    // parsen die Antwort manuell. So eliminiert sich der ganze
    // Schema-Validation-Pfad als Fehlerquelle.
    //
    // Gemini 2.5 Pro Multimodal in "text"-Mode ist erfahrungsgemaess
    // sehr zuverlaessig mit JSON-Output wenn der Prompt klar ist.
    const rawText = await callGeminiMultimodal<string>({
      parts,
      // Kein schema → callGeminiMultimodal returnt den Text direkt
      systemInstruction:
        SYSTEM_INSTRUCTION +
        `\n\nANTWORT-FORMAT: Gib AUSSCHLIESSLICH ein JSON-Objekt zurueck mit diesen Feldern (keine Code-Fences, kein Markdown, nur raw JSON):\n{\n  "lightingOptions": ["string", "string", "string", "string", "string"],\n  "sceneOptions": ["string", "string", "string", "string", "string"],\n  "styleSuffix": "string",\n  "negativeAddition": "string",\n  "cameraAesthetic": "string",\n  "heroElementGuidance": "string",\n  "angleFlat": "string",\n  "angleLayered": "string",\n  "angleTall": "string",\n  "angleLiquid": "string",\n  "angleMixed": "string"\n}`,
      model: "pro",
      temperature: 0.5,
      // Hoeher als vorher (2048): JSON-Output mit 5+5 verbosen Strings
      // kann knapp werden. 4096 gibt Headroom.
      maxOutputTokens: 4096,
      thinkingBudget: 0,
      retries: 1,
    });
    console.log(
      `[analyze-style] gemini-pro durch in ${Date.now() - tVision}ms, response length ${rawText.length}`
    );
    // Code-Fences abstrippen falls Gemini doch welche packt
    const cleaned = rawText
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    try {
      raw = JSON.parse(cleaned) as RawStyleResponse;
    } catch (parseErr) {
      console.error(
        "[analyze-style] JSON-parse failed. Raw response (first 1500 chars):",
        cleaned.slice(0, 1500)
      );
      throw parseErr;
    }
  } catch (err) {
    // Volles Detail loggen — vorher nur die ersten 400 Zeichen, das hat
    // den eigentlichen Validator-Hint verschluckt.
    const errMsg = err instanceof Error ? err.message : String(err);
    const detail =
      err && typeof err === "object" && "detail" in err
        ? String((err as { detail: unknown }).detail).slice(0, 2000)
        : "(no detail)";
    console.error("[analyze-style] gemini-pro call failed");
    console.error("  message:", errMsg);
    console.error("  detail :", detail);
    return null;
  }

  // Defensive normalization — Schema-Limits enforcen + Whitespace cleanen.
  // Wir bauen das nested defaultAngles-Objekt aus den flachen angle*-
  // Feldern zusammen (Gemini-Schema hatte mit nested objects Probleme,
  // siehe PR 9-Kommentar oben).
  const angleEntries: Array<[string, string]> = [
    ["flat", (raw.angleFlat ?? "").trim()],
    ["layered", (raw.angleLayered ?? "").trim()],
    ["tall", (raw.angleTall ?? "").trim()],
    ["liquid", (raw.angleLiquid ?? "").trim()],
    ["mixed", (raw.angleMixed ?? "").trim()],
  ].filter(([, v]) => v.length > 0) as Array<[string, string]>;
  const defaultAngles =
    angleEntries.length > 0
      ? (Object.fromEntries(angleEntries) as BrandImageStyleOverride["defaultAngles"])
      : undefined;

  return {
    lightingOptions: (raw.lightingOptions ?? [])
      .filter((s) => s && s.trim())
      .slice(0, 5),
    sceneOptions: (raw.sceneOptions ?? [])
      .filter((s) => s && s.trim())
      .slice(0, 5),
    styleSuffix: (raw.styleSuffix ?? "").trim(),
    negativeAddition: (raw.negativeAddition ?? "").trim(),
    cameraAesthetic: (raw.cameraAesthetic ?? "").trim(),
    heroElementGuidance: (raw.heroElementGuidance ?? "").trim(),
    defaultAngles,
  };
}
