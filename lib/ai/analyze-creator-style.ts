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

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    lightingOptions: {
      type: "array",
      items: { type: "string" },
      minItems: 5,
      maxItems: 5,
      description:
        "EXAKT 5 englische Lighting-Strings, die als Gemini-Enum fuer Stage 2 dienen. Format: 'warm morning light streaming from the left with soft shadows' oder 'cool diffused daylight with even illumination'. Jeder String beschreibt EINEN spezifischen Lighting-Mood, den der Creator in seinen Bildern verwendet. Variiere zwischen direction (left/right/above), intensity (soft/bright), color temperature (warm amber / neutral / cool). NIE generisch 'natural light' — immer Detail.",
    },
    sceneOptions: {
      type: "array",
      items: { type: "string" },
      minItems: 5,
      maxItems: 5,
      description:
        "EXAKT 5 englische Scene-Strings — beschreiben jeweils die Surface, auf der das Essen steht. Format: 'a smooth pale-grey concrete kitchen counter' oder 'a warm walnut wooden cutting board'. Wenn der Creator mehrere Surfaces nutzt, decken die 5 Strings die Range ab. Wenn nur eine Surface erkennbar ist, 5 leichte Varianten davon (smooth/lightly-textured/near-window/etc).",
    },
    styleSuffix: {
      type: "string",
      description:
        "Optionaler English Suffix, der an jeden Hero-Prompt angehaengt wird. Ein oder zwei Saetze, die den Overall-Look festnageln. Leerer String wenn nicht noetig.",
    },
    negativeAddition: {
      type: "string",
      description:
        "Comma-separated englische Negative-Items, spezifisch fuer diesen Creator. Was sieht man in seinen Reels NIE? z.B. 'no parsley or scattered herbs around the dish, no cast-iron pan as vessel'. Maximal 5 Items. Leerer String wenn keine spezifischen Anti-Patterns auffallen.",
    },
    cameraAesthetic: {
      type: "string",
      description:
        "Ein English Satz zum Camera-/Photographer-Setup. Beschreibt das Gesamtgefuehl der Bilder. Bienes-Stil: 'natural unstaged food photograph, homemade-feeling, no studio look'. Cookbook-Stil: 'Shot on Leica SL2 50mm lens at f/5.6, cookbook-style instagram food photograph, homemade imperfect character'. Pick den passenden Vibe basierend auf den Bildern.",
    },
    heroElementGuidance: {
      type: "string",
      description:
        "English Beschreibung wo + wie der Creator typischerweise eine Hero-Zutat oder Garnish im Bild platziert. Bienes-Format: 'A complete English phrase describing the scene: a small wooden cutting board with a small ceramic bowl of [main recipe ingredient] sits softly in the background, behind the dish.' Wenn kein konsistentes Pattern erkennbar: leerer String.",
    },
    defaultAngles: {
      type: "object",
      properties: {
        flat: {
          type: "string",
          description:
            "Camera-Angle-Anweisung fuer flache Dishes (pizza, pancake, cookie). z.B. 'from a high overhead angle looking down (about 75 degrees)' wenn der Creator top-down bevorzugt. Leer wenn unklar.",
        },
        layered: { type: "string" },
        tall: { type: "string" },
        liquid: { type: "string" },
        mixed: { type: "string" },
      },
      description:
        "Per-DishShape Camera-Angles. Bienes Pattern: flat/mixed bei 75° tilted (nicht strict 90), layered/liquid bei 30° three-quarter, tall bei 45° eye-level. Wenn der Creator durchgehend einen Angle nutzt, gib den fuer alle Shapes. Wenn unklar: leer lassen (Pipeline nimmt Defaults).",
    },
  },
  required: [
    "lightingOptions",
    "sceneOptions",
    "styleSuffix",
    "negativeAddition",
    "cameraAesthetic",
    "heroElementGuidance",
    "defaultAngles",
  ],
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

// Fetched die displayUrls (Instagram-CDN-Links) als Buffer und konvertiert
// zu base64 fuer den multimodal Gemini-Call. Parallel mit Promise.all —
// auch 8 Fetches sind in ~3-5s durch.
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
      const buf = await res.arrayBuffer();
      const mime =
        res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/jpeg";
      return {
        base64: Buffer.from(buf).toString("base64"),
        mime,
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
        // splitten und re-formatten fuer den gemeinsamen Pool.
        return frames.map((f) => {
          const [, base64 = ""] = f.dataUri.split(",");
          return { base64, mime: "image/jpeg" };
        });
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

  // Cap auf 16 (Gemini-Multimodal-Limit fuer inline images). Reel-Frames
  // zuerst — die zeigen meist das fertige Dish, das ist das wichtigste
  // Style-Signal. Cover als Backup.
  const images = [...reelFrames, ...coverImages].slice(0, 16);
  if (images.length < 2) {
    console.warn(
      `[analyze-style] zu wenige Bilder im Pool (${images.length}), ueberspringe Vision-Analyse`
    );
    return null;
  }

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
  let raw: BrandImageStyleOverride;
  try {
    raw = await callGeminiMultimodal<BrandImageStyleOverride>({
      parts,
      schema: RESPONSE_SCHEMA,
      systemInstruction: SYSTEM_INSTRUCTION,
      // Pro statt Flash — bessere Bild-Detail-Erkennung, die DNA wird nur
      // einmal pro Creator generiert, also lohnt sich die hoehere Latenz +
      // Kosten.
      model: "pro",
      // Mittlere Temp — Voice + Detail, aber nicht Halluzination
      temperature: 0.5,
      maxOutputTokens: 2048,
      thinkingBudget: 0,
      retries: 1,
    });
    console.log(
      `[analyze-style] gemini-pro durch in ${Date.now() - tVision}ms`
    );
  } catch (err) {
    console.error(
      "[analyze-style] gemini-pro call failed",
      err instanceof Error ? err.message : err
    );
    return null;
  }

  // Defensive normalization — Schema-Limits enforcen + Whitespace cleanen
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
    defaultAngles: raw.defaultAngles
      ? Object.fromEntries(
          Object.entries(raw.defaultAngles).filter(
            ([k, v]) =>
              ["flat", "layered", "tall", "liquid", "mixed"].includes(k) &&
              typeof v === "string" &&
              v.trim()
          )
        )
      : undefined,
  };
}
