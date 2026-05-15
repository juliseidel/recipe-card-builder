import { callGemini } from "./gemini";
import type { Brand, BrandVoiceProfile } from "@/lib/brands";
import type { InstagramProfile } from "@/lib/integrations/apify";

// Voice-Profile-Analyzer fuer das Creator-Onboarding. Bekommt das
// gescrapete Profil (Bio + ~10-30 letzte Captions) und leitet daraus die
// Tonalitaets-DNA ab.
//
// Wird einmalig bei /api/brands/analyze-instagram aufgerufen, das
// Ergebnis landet in brand.data.voiceProfile. Spaeter zieht es jede
// Text-Generierungs-Pipeline (Pack-Titel, Subtitle, Description,
// Foreword) als Steuersignal.
//
// Brand-agnostisch by design: keine hardcoded Beispiele aus Bienes
// Welt. Jeder Creator bekommt sein eigenes Profil aus SEINEN echten
// Captions abgeleitet.

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    formality: {
      type: "string",
      enum: ["du", "Sie", "ihr"],
      description:
        "Welche Anrede der Creator in den Captions DOMINANT nutzt. 'du' bei direkter persoenlicher Ansprache (Standard fuer Food/Fitness-Creator). 'Sie' nur wenn der Creator wirklich foermlich schreibt (selten). 'ihr' wenn die Captions kollektiv an eine Community gerichtet sind (Mehrzahl).",
    },
    language: {
      type: "string",
      enum: ["de", "en", "mixed"],
      description:
        "Hauptsprache der Captions. 'mixed' nur wenn der Creator durchgaengig auf zwei Sprachen postet (selten — meist eindeutig).",
    },
    emojiUsage: {
      type: "string",
      enum: ["none", "sparse", "frequent"],
      description:
        "Emoji-Frequenz im Stil des Creators. 'none' = keine bis kaum Emojis. 'sparse' = 1-3 Emojis pro Caption. 'frequent' = 4+ pro Caption oder Emoji-haeufig.",
    },
    toneDescriptors: {
      type: "array",
      items: { type: "string" },
      description:
        "3-6 Adjektive auf Deutsch, die die Tonalitaet treffend beschreiben. KEINE generischen Worte wie 'positiv' oder 'gut' — sei konkret. Beispiele: 'warm', 'ehrlich', 'selbstironisch', 'sachlich', 'direkt', 'verspielt', 'pragmatisch', 'einladend', 'unverbluemt', 'lakonisch', 'enthusiastisch'.",
    },
    signaturePhrases: {
      type: "array",
      items: { type: "string" },
      description:
        "4-8 Vokabel-Anker: Worte oder Kurz-Phrasen, die der Creator typisch nutzt — direkt aus den Captions extrahiert. Beispiele: 'Bürotage', 'Heißhunger', 'Mädels', 'Babe', 'Schatz', 'easy peasy', 'Hot Girl Walk', 'Sattmacher'. Nimm nur Worte, die wirklich in den Captions vorkommen — nicht erfinden.",
    },
    bannedPhrases: {
      type: "array",
      items: { type: "string" },
      description:
        "3-8 Tabu-Worte: Begriffe, die der Creator NIEMALS oder NEGATIV in seinen Captions benutzt. Beispiele bei Anti-Diaet-Creator: 'Diät', 'Verzicht', 'sündigen', 'fit werden'. Beispiele bei seriös-saturierten Cookbook-Creator: 'easy', 'mega', 'krass'. Inferiere aus dem GEGENTEIL: wenn der Creator 'satt' sagt, ist 'Diät' wahrscheinlich tabu.",
    },
    forbiddenTopics: {
      type: "array",
      items: { type: "string" },
      description:
        "3-6 Themen, die der Creator nie behandelt. Beispiele: 'Before/After-Vergleiche', 'extreme Diaeten', 'Kalorien-Shaming', 'Mahlzeiten-Verzicht', 'Workout-Pflicht', 'Beauty-Standards'. Wieder: aus dem Inhalt der Captions inferieren, nicht erfinden.",
    },
    captionExamples: {
      type: "array",
      items: { type: "string" },
      description:
        "3-5 ECHTE Caption-Auszuege (verbatim aus den geliefertem Input!) die den Stil am besten repraesentieren. Max ~400 chars pro Auszug, Anfang-bis-natuerliche-Satz-Grenze. Diese werden spaeter als Few-Shot in jedem Text-Prompt mit-gezeigt, damit Gemini den Stil kopieren kann. Waehle Captions, die typisch sind — nicht Outlier.",
    },
  },
  required: [
    "formality",
    "language",
    "emojiUsage",
    "toneDescriptors",
    "signaturePhrases",
    "bannedPhrases",
    "forbiddenTopics",
    "captionExamples",
  ],
};

const SYSTEM_INSTRUCTION = `Du analysierst die Schreibstimme eines Social-Media-Creators (Instagram oder TikTok) und destillierst sie zu einem Voice-Profil. Das Profil wird spaeter genutzt, um Pack-Texte (Titel, Beschreibungen, Vorworte) GENAU IM STIL DIESES CREATORS zu generieren.

Deine Aufgabe ist Stil-Analyse, nicht Inhalt-Zusammenfassung. Du achtest auf:
- WIE der Creator schreibt (Satzlaenge, Wortwahl, Anrede, Rhythmus)
- WAS fuer typische Worte/Phrasen oft wiederkehren
- WELCHE Themen er meidet oder negativ besetzt
- WELCHE Tonalitaet sich rauskristallisiert (warm vs. sachlich, ehrlich vs. inszeniert, lakonisch vs. enthusiastisch)

WICHTIG — keine Marketing-Klischees:
- Sag nicht "warm und einladend" wenn das nicht stimmt
- Sag nicht "professionell" als Default
- Sei konkret: lieber "lakonisch-direkt mit Insider-Witzen" als "freundlich"

WICHTIG — captionExamples sind VERBATIM:
- Kopiere die Captions EXAKT wie sie kommen, inkl. Umlaute, Punktion, Zeilenumbruechen
- Erfinde NIE Captions, paraphrasiere NICHT, korrigiere NICHT
- Schneide nur am Ende ab (max 400 chars), an einer natuerlichen Satz-Grenze

WICHTIG — signaturePhrases sind echte Vokabeln:
- Worte, die du WIRKLICH in den Input-Captions findest
- Wenn der Creator "Babe" sagt → in die Liste. Wenn nicht → nicht erfinden.

Antworte AUSSCHLIESSLICH im JSON-Schema.`;

export async function analyzeVoiceProfile(
  profile: InstagramProfile
): Promise<BrandVoiceProfile> {
  const captions = profile.latestPosts
    .slice(0, 15)
    .map((p) => p.caption ?? "")
    .filter((c) => c.trim().length > 0);
  return analyzeVoiceProfileFromCaptions(captions, {
    username: profile.username,
    biography: profile.biography ?? "",
  });
}

/** Variante, die direkt eine Liste Captions + Context entgegennimmt.
 *  Wird vom Lazy-Backfill genutzt: Captions aus creator_reels-DB statt
 *  Live-Apify-Scrape. Identische Pipeline ab hier. */
export async function analyzeVoiceProfileFromCaptions(
  captions: string[],
  context: { username: string; biography?: string }
): Promise<BrandVoiceProfile> {
  // Trim auf max 600 chars pro Caption damit ein einzelner Roman-Post
  // nicht alles dominiert. Maximal 15 Stueck — genug Signal fuer den Stil.
  const captionBlock = captions
    .slice(0, 15)
    .map((c, i) => {
      const trimmed = (c ?? "").slice(0, 600).trim();
      return trimmed ? `--- Post ${i + 1} ---\n${trimmed}` : null;
    })
    .filter(Boolean)
    .join("\n\n");

  const bioBlock = context.biography?.trim()
    ? `Bio-Selbstbeschreibung:\n"${context.biography.trim()}"\n\n`
    : "";

  const prompt = `Analysiere die Schreibstimme von @${context.username}.

${bioBlock}Letzte Captions (echte Daten — die captionExamples-Auswahl muss aus diesem Material kommen):

${captionBlock || "(keine Captions verfuegbar — leite ein neutrales Default-Profil aus der Bio ab)"}

Erstelle das Voice-Profil im JSON-Schema. Sei konkret, nicht generisch.`;

  const result = await callGemini<Omit<BrandVoiceProfile, "updatedAt">>({
    prompt,
    schema: RESPONSE_SCHEMA,
    systemInstruction: SYSTEM_INSTRUCTION,
    // Mittlere Temperatur — Voice-Erkennung braucht Treffsicherheit, aber
    // auch ein bisschen Nuance bei Tone-Descriptors. 0.45 hat sich
    // empirisch als guter Trade-Off gezeigt.
    temperature: 0.45,
    maxOutputTokens: 2048,
    thinkingBudget: 0,
    retries: 2,
    model: "flash",
  });

  // Defensive Sanitization — Schema-Limits sind Hints, wir clampen hart.
  return {
    formality:
      result.formality === "Sie" || result.formality === "ihr"
        ? result.formality
        : "du",
    language:
      result.language === "en" || result.language === "mixed"
        ? result.language
        : "de",
    emojiUsage:
      result.emojiUsage === "frequent" || result.emojiUsage === "none"
        ? result.emojiUsage
        : "sparse",
    toneDescriptors: (result.toneDescriptors ?? [])
      .filter((s) => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim().slice(0, 40))
      .slice(0, 6),
    signaturePhrases: (result.signaturePhrases ?? [])
      .filter((s) => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim().slice(0, 40))
      .slice(0, 8),
    bannedPhrases: (result.bannedPhrases ?? [])
      .filter((s) => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim().slice(0, 40))
      .slice(0, 8),
    forbiddenTopics: (result.forbiddenTopics ?? [])
      .filter((s) => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim().slice(0, 60))
      .slice(0, 6),
    captionExamples: (result.captionExamples ?? [])
      .filter((s) => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim().slice(0, 400))
      .slice(0, 5),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Prompt-Helpers — werden von allen Text-Pipelines genutzt ─────────────

/** Baut einen Voice-Profil-Block fuer System-Instructions. Wenn kein
 *  Profil vorhanden, gibt eine generische Default-Anweisung zurueck. */
export function formatVoiceProfileForPrompt(
  profile: BrandVoiceProfile | undefined,
  brandName: string
): string {
  if (!profile) {
    return `TONALITAET (kein Voice-Profil vorhanden — generischer Default):
- Sprich in der Stimme von ${brandName}, du-Form, persoenlich.
- Warm, ehrlich, konkret — wie eine Freundin am Kuechentisch.
- KEINE Marketing-Sprache, KEINE Emojis, KEINE Hashtags.`;
  }

  const lines: string[] = [];
  lines.push(`VOICE-PROFIL von ${brandName} (aus echten Captions abgeleitet — NUTZE ES KONSEQUENT):`);
  lines.push(`- Anrede: "${profile.formality}"-Form`);
  lines.push(`- Sprache: ${profile.language}`);
  lines.push(`- Stil-Adjektive: ${profile.toneDescriptors.join(", ")}`);
  if (profile.signaturePhrases.length > 0) {
    lines.push(
      `- Vokabel-Anker (gerne wiederverwenden wo es natuerlich passt): ${profile.signaturePhrases.join(", ")}`
    );
  }
  if (profile.bannedPhrases.length > 0) {
    lines.push(
      `- Brand-Tabus (NIEMALS benutzen): ${profile.bannedPhrases.join(", ")}`
    );
  }
  if (profile.forbiddenTopics.length > 0) {
    lines.push(
      `- Tabu-Themen (NICHT ansprechen): ${profile.forbiddenTopics.join(", ")}`
    );
  }
  return lines.join("\n");
}

/** Baut einen Few-Shot-Block mit echten Captions. WICHTIGSTER Hebel
 *  gegen KI-Sound: die KI sieht 3-5 echte Beispiele und kopiert den
 *  Stil. Leerer String wenn keine Beispiele vorhanden. */
export function formatCaptionFewShot(
  profile: BrandVoiceProfile | undefined
): string {
  if (!profile || profile.captionExamples.length === 0) return "";
  return `SO SCHREIBT DIESE PERSON (echte Captions — orientiere dich am STIL, nicht am Inhalt):

${profile.captionExamples.map((c, i) => `Beispiel ${i + 1}:\n${c}`).join("\n\n---\n\n")}`;
}

// ─── Lazy-Backfill fuer bestehende Brands ohne Voice-Profil ──────────────
// Brands, die vor der Voice-Profile-Pipeline angelegt wurden (Biene/Julia
// als Code-Brands, oder fruehe Custom-Brands), haben kein gespeichertes
// Profil. Beim ersten Pack-Text-Generierungs-Call ziehen wir Captions aus
// creator_reels, leiten ein Profil ab + persistieren es. Naechster Call
// nutzt dann das gespeicherte Profil ohne Extra-Call.
//
// In-Memory-Cache (Modul-Level Map) damit Concurrency-Bursts in derselben
// Lambda nicht parallel mehrere Gemini-Calls fuer denselben Brand
// triggern — der erste gewinnt, die anderen warten am gleichen Promise.

const lazyProfileCache = new Map<string, Promise<BrandVoiceProfile | null>>();

/** Gibt den Brand zurueck — wenn voiceProfile fehlt, wird's lazy abgeleitet
 *  und persistiert. Fail-safe: wenn keine Reel-Captions verfuegbar sind,
 *  returnt der Brand unveraendert. Pipelines fallen dann auf Generic-
 *  Defaults zurueck.
 *
 *  WICHTIG fuer Brand-agnostik: jeder Brand bekommt sein eigenes Profil,
 *  keine hardcoded Vorlagen. */
export async function ensureBrandVoiceProfile(
  brand: Brand | null | undefined
): Promise<Brand | null> {
  if (!brand) return null;
  if (brand.voiceProfile) return brand;

  // Cache-Lookup: laeuft schon eine Backfill-Promise? Auf die warten.
  const cached = lazyProfileCache.get(brand.slug);
  if (cached) {
    const profile = await cached;
    return profile ? { ...brand, voiceProfile: profile } : brand;
  }

  const promise = backfillVoiceProfileForBrand(brand);
  lazyProfileCache.set(brand.slug, promise);

  const profile = await promise;
  return profile ? { ...brand, voiceProfile: profile } : brand;
}

async function backfillVoiceProfileForBrand(
  brand: Brand
): Promise<BrandVoiceProfile | null> {
  // Lazy imports — vermeiden Server-Only-Module-Bind beim Edge-Runtime.
  // creator-reels-server + custom-brands-server sind Node-only.
  let captions: string[] = [];
  try {
    const { getRecipeReelsForBrand } = await import("@/lib/creator-reels-server");
    const reels = await getRecipeReelsForBrand(brand.slug);
    captions = reels
      .map((r) => r.caption ?? "")
      .filter((c) => c.trim().length > 50) // skippen sehr kurze Captions
      .slice(0, 15);
  } catch (err) {
    console.warn(
      `[voice-profile] backfill: konnte Reels fuer ${brand.slug} nicht laden`,
      err instanceof Error ? err.message : err
    );
    return null;
  }

  // Mindestens 5 Captions noetig fuer ein vernuenftiges Profil.
  if (captions.length < 5) {
    console.warn(
      `[voice-profile] backfill skipped: brand=${brand.slug} hat nur ${captions.length} Captions in DB`
    );
    return null;
  }

  let profile: BrandVoiceProfile;
  try {
    profile = await analyzeVoiceProfileFromCaptions(captions, {
      username: brand.handle.replace(/^@/, ""),
      biography: brand.bio,
    });
  } catch (err) {
    console.warn(
      `[voice-profile] backfill failed for ${brand.slug}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }

  // Persistierung (fire-and-forget — falls fail, beim naechsten Call retry).
  // Nur Custom-Brands persistieren — Code-Brands liegen im Code, nicht in DB.
  try {
    const { updateBrandVoiceProfile } = await import("@/lib/custom-brands-server");
    await updateBrandVoiceProfile(brand.slug, profile);
    console.log(`[voice-profile] backfilled + persisted for ${brand.slug}`);
  } catch (err) {
    // Persistierung schlaegt fehl wenn Brand ein Code-Brand ist (kein
    // DB-Eintrag). Das ist OK — wir geben das Profil trotzdem in-RAM zurueck.
    console.log(
      `[voice-profile] backfilled (in-memory only) for ${brand.slug}:`,
      err instanceof Error ? err.message : err
    );
  }

  return profile;
}
