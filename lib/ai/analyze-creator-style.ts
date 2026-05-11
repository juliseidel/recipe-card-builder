import { callGeminiMultimodal } from "./gemini";
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

const SYSTEM_INSTRUCTION = `Du analysierst Food-Photography-Reel-Covers/Posts eines Instagram-Creators und leitest daraus die Image-Pipeline-DNA ab. Ziel: ein zukuenftiges KI-Bild-Generierungs-System soll den visuellen Stil dieses Creators reproduzieren koennen.

Aus 6-12 Bildern erkennst du Muster:
1. **Lighting**: Welche Richtungen, Intensitaeten, Farb-Temperaturen wiederholen sich? Morning/Afternoon/Diffused/Backlit/Amber?
2. **Surface/Scene**: Worauf steht das Essen? Pale-grey concrete? Wooden cutting board? White marble? Linen? Beschreibe das genau — Material UND Farb-Ton.
3. **Camera**: Eher cookbook-magazine-DSLR-Aesthetik oder homemade-natural-smartphone-Look? Welche Tiefen-Schaerfe?
4. **Hero-Element**: Wo + wie platziert der Creator Garnish oder Hero-Zutat? Im Hintergrund? Daneben? Auf dem Gericht? Mit welchem Prop (Brett, Schale, Tuch)?
5. **Angles**: Top-down oder Three-Quarter? Bei verschiedenen Dish-Shapes — flach/hoch/liquid — andere Angles?
6. **Anti-Patterns**: Was sieht man NIE in seinen Bildern? (z.B. cast-iron, plastic, parsley, studio lighting)

Wichtig:
- Schreibe alle Antwort-Strings auf ENGLISCH — sie gehen direkt in englische Flux-Prompts (Bild-Generierungs-System).
- Sei spezifisch, nicht generisch. 'warm light' ist schlecht — 'warm morning light streaming from the left with soft shadows' ist gut.
- Wenn ein Pattern nicht klar erkennbar ist: leere Werte zurueckgeben statt halluzinieren. Die Pipeline hat Fallbacks.
- defaultAngles: Wenn der Creator durchgehend einen Angle nutzt (z.B. immer top-down), gib den fuer alle 5 Shape-Keys. Wenn shape-spezifisch variiert, entsprechend. Wenn unklar: leeres Objekt.

Antworte AUSSCHLIESSLICH im JSON-Schema, ohne Erklaerung.`;

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

export async function analyzeCreatorVisualStyle(
  posts: InstagramProfilePost[]
): Promise<BrandImageStyleOverride | null> {
  // Filter auf Posts mit displayUrl — Video-only-Posts werden uebersprungen
  // (wir koennten Reel-Cover-Frames machen, aber das ist Frame-Extraction
  // mit ffmpeg, das brauchen wir hier nicht — die Cover-displayUrl reicht).
  const candidateUrls = posts
    .filter((p) => p.displayUrl)
    .slice(0, 8)
    .map((p) => p.displayUrl as string);

  if (candidateUrls.length < 3) {
    // Bei <3 Bildern ist die Vision-Analyse nicht aussagekraeftig genug.
    // Pipeline-Fallback uebernimmt dann generischen Style.
    return null;
  }

  const images = await fetchImagesAsBase64(candidateUrls);
  if (images.length < 3) {
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

  const raw = await callGeminiMultimodal<BrandImageStyleOverride>({
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
