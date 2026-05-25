import { callGemini } from "./gemini";
import type { Brand } from "@/lib/brands";
import type { InstagramProfile } from "@/lib/integrations/apify";

// Creator-Story-Analyzer: destilliert aus Bio + Reel-Captions + Voice-
// Profil eine persoenliche Lebens-/Themen-Story (5-10 Saetze) ueber den
// Creator. Wird in brand.data.creatorStory persistiert und vom Foreword-
// Generator als ICH-Form-Persoenlichkeitskontext genutzt.
//
// Warum separat von voiceProfile: voiceProfile beschreibt WIE jemand
// schreibt (Tonalitaet, Vokabeln). creatorStory beschreibt WER jemand IST
// (Werdegang, Wendepunkt, warum-kocht-sie-was-sie-kocht). Beides sind
// orthogonale Signale fuer narrative Text-Generierung.
//
// Modell: gemini-2.5-pro. Bei narrativer Destillation deutlich treff-
// sicherer als Flash — wir lassen die KI nicht "schoenschreiben", sondern
// aus echten Captions ein Persoenlichkeits-Portrait extrahieren. Das
// braucht Tiefe.

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    story: {
      type: "string",
      description:
        "5-10 zusammenhaengende Saetze auf Deutsch, ICH-Form, in der Stimme der Creatorin selbst. Erzaehlt WER sie ist, was sie geprägt hat, warum sie das kocht/postet was sie kocht/postet. Klingt wie ein persoenliches Vorwort in einem Kochbuch — nicht wie eine Bio. KEINE Marketing-Floskeln, KEINE Aufzaehlungen, KEIN 'Hi ich bin', KEINE Werbesprache. Konkret, sinnlich, mit echten Details aus den Captions. Max ~1200 Zeichen.",
    },
  },
  required: ["story"],
};

const SYSTEM_INSTRUCTION = `Du destillierst aus den Social-Media-Inhalten eines Creators eine persoenliche Lebens-/Themen-Story — wie sie selbst sie in einem Kochbuch-Vorwort erzaehlen wuerde.

Deine Aufgabe ist Persoenlichkeits-Portrait, nicht Bio-Zusammenfassung. Du achtest auf:
- WER ist diese Person — was hat sie geprägt, was war ihr Wendepunkt
- WARUM kocht/postet sie das was sie kocht/postet
- WAS macht ihre Beziehung zum Essen/Sport/Thema besonders
- WELCHE konkreten Erlebnisse oder Werte tauchen in ihren Captions auf

WICHTIG — du schreibst in ICH-Form, AUS DER PERSPEKTIVE der Creatorin:
- Nicht "Sabrina ist eine Foodbloggerin, die..." → sondern "Ich koche seit ich..."
- Nicht "Sie verlor 20 kg" → sondern "Ich habe 20 kg abgenommen, ohne..."

WICHTIG — Anti-Klischee:
- Sag nicht "Ich liebe es, gesund zu kochen" — das sagt jeder
- Sag konkret WAS sie liebt: "Ich liebe den Moment, wenn der Teig genau richtig glaenzt"
- Sag nicht "Mein Ziel ist es, dich zu inspirieren" — Werbesprache, raus
- Erlaubt: konkrete Erinnerungen, Wendepunkte, kleine Rituale ("ich back das jeden Sonntag")

WICHTIG — Story-Bogen:
- Anfang: Wer bin ich / wo komme ich her
- Mitte: Was hat mich geprägt / was war mein Aha-Moment
- Ende: Was kocht/baue/zeige ich heute und warum

WICHTIG — verbatim Captions nicht plagiieren, aber Stil + konkrete Details uebernehmen:
- Wenn die Creatorin in Captions von "Buerotagen" spricht → kann in der Story stehen "an meinen Buerotagen koche ich..."
- Wenn sie Gewichtsverlust nicht explizit thematisiert → respektiere das, mache keine Diaet-Story draus
- Wenn die Bio bestimmte Themen ausschliesst (forbiddenTopics) → respektiere das absolut

WICHTIG — Keine ALL-CAPS, keine Emojis, keine Hashtags, keine Em-Dashes (—), keine Anfuehrungszeichen.

Antworte AUSSCHLIESSLICH im JSON-Schema mit dem story-Feld.`;

/** Variante fuer Live-Onboarding: bekommt das frische Apify-Profil und
 *  baut die Story aus Bio + Top-Captions. */
export async function analyzeCreatorStory(
  profile: InstagramProfile,
  context: { voiceDescriptors?: string[]; forbiddenTopics?: string[] } = {}
): Promise<string> {
  const captions = profile.latestPosts
    .slice(0, 15)
    .map((p) => p.caption ?? "")
    .filter((c) => c.trim().length > 0);
  return analyzeCreatorStoryFromCaptions(captions, {
    username: profile.username,
    biography: profile.biography ?? "",
    voiceDescriptors: context.voiceDescriptors,
    forbiddenTopics: context.forbiddenTopics,
  });
}

/** Variante fuer Lazy-Backfill: Captions kommen aus creator_reels-DB
 *  statt Live-Scrape. Identische Pipeline ab hier. */
export async function analyzeCreatorStoryFromCaptions(
  captions: string[],
  context: {
    username: string;
    biography?: string;
    voiceDescriptors?: string[];
    forbiddenTopics?: string[];
  }
): Promise<string> {
  // Trim auf max 600 chars pro Caption damit kein Roman-Post alles dominiert.
  // 15 Captions reichen fuer Persoenlichkeits-Signal.
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

  const voiceBlock = context.voiceDescriptors?.length
    ? `Voice-Stil (aus Caption-Analyse): ${context.voiceDescriptors.join(", ")}.\n\n`
    : "";

  const forbiddenBlock = context.forbiddenTopics?.length
    ? `TABU-Themen (NICHT in die Story aufnehmen): ${context.forbiddenTopics.join(", ")}.\n\n`
    : "";

  const prompt = `Destilliere eine persoenliche Lebens-/Themen-Story fuer @${context.username}.

${bioBlock}${voiceBlock}${forbiddenBlock}Letzte Captions (echte Daten — die Story muss aus diesem Material kommen):

${captionBlock || "(keine Captions verfuegbar — leite eine vorsichtige Default-Story aus der Bio ab)"}

Schreibe die Story in ICH-Form, 5-10 Saetze, wie ein Vorwort-Text in einem Kochbuch. Konkret, persoenlich, ohne Marketing-Floskeln.

Antwort nur als JSON nach Schema.`;

  const result = await callGemini<{ story: string }>({
    prompt,
    schema: RESPONSE_SCHEMA,
    systemInstruction: SYSTEM_INSTRUCTION,
    // Niedrigere Temperatur fuer Treffsicherheit. Story soll echt klingen,
    // nicht erfunden. 0.4 hat sich empirisch als Sweet-Spot fuer Persoenlich-
    // keits-Destillation gezeigt — hoch genug fuer Nuance, niedrig genug
    // gegen Halluzination.
    temperature: 0.4,
    maxOutputTokens: 2048,
    // thinkingBudget ABSICHTLICH unset: Pro darf bei narrativer Destillation
    // nachdenken (Persoenlichkeit aus Captions extrahieren ist nicht trivial).
    // Auf Flash-Pattern (thinkingBudget=0) wuerde die Story flacher klingen.
    retries: 2,
    model: "pro",
  });

  return (result.story ?? "").trim().slice(0, 1400);
}

// ─── Prompt-Helper — wird vom Foreword-Generator genutzt ──────────────────

/** Baut einen Creator-Story-Block fuer den Foreword-System-Prompt. Wenn
 *  keine Story vorhanden, gibt leeren String zurueck — Foreword-Generator
 *  faellt dann auf bio/tagline-basierte Defaults zurueck. */
export function formatCreatorStoryForPrompt(brand: Brand): string {
  if (!brand.creatorStory?.trim()) return "";
  return `WER SPRICHT HIER — Lebens-/Themen-Story von ${brand.name}:

${brand.creatorStory.trim()}

Nutze diesen Persoenlichkeits-Kontext fuer das Vorwort: die Texte muessen sich anfuehlen, als wuerde GENAU DIESE Person sprechen — nicht ein generisches Creator-Template.`;
}

// ─── Lazy-Backfill fuer bestehende Brands ohne creatorStory ───────────────
// Parallel zu ensureBrandVoiceProfile in analyze-voice-profile.ts.

const lazyStoryCache = new Map<string, Promise<string | null>>();

/** Gibt den Brand zurueck — wenn creatorStory fehlt, wird sie lazy
 *  abgeleitet und persistiert. Fail-safe: wenn keine Reel-Captions
 *  verfuegbar sind, returnt der Brand unveraendert. Foreword-Pipeline
 *  faellt dann auf bio/tagline-Defaults zurueck. */
export async function ensureBrandCreatorStory(
  brand: Brand | null | undefined
): Promise<Brand | null> {
  if (!brand) return null;
  if (brand.creatorStory?.trim()) return brand;

  const cached = lazyStoryCache.get(brand.slug);
  if (cached) {
    const story = await cached;
    return story ? { ...brand, creatorStory: story } : brand;
  }

  const promise = backfillCreatorStoryForBrand(brand);
  lazyStoryCache.set(brand.slug, promise);

  const story = await promise;
  return story ? { ...brand, creatorStory: story } : brand;
}

async function backfillCreatorStoryForBrand(
  brand: Brand
): Promise<string | null> {
  // Lazy imports — Server-Only-Modules nicht in Edge-Runtime binden.
  let captions: string[] = [];
  try {
    const { queryReelsForBrand } = await import("@/lib/creator-reels-server");
    // onlyRecipes:false damit auch Fitness/Mindset/Tutorial-Reels reinkommen.
    // Persoenlichkeit zeigt sich quer ueber alle Content-Types — gerade bei
    // Fitness-Coaches ist die Story oft in den Mindset-Captions, nicht in
    // Recipe-Posts. queryReelsForBrand sortiert default nach like_count, was
    // uns die echtesten "Persoenlichkeits-Banger" liefert.
    const reels = await queryReelsForBrand({
      brandSlug: brand.slug,
      onlyRecipes: false,
      limit: 15,
    });
    captions = reels
      .map((r) => r.caption ?? "")
      .filter((c) => c.trim().length > 50)
      .slice(0, 15);
  } catch (err) {
    console.warn(
      `[creator-story] backfill: konnte Reels fuer ${brand.slug} nicht laden`,
      err instanceof Error ? err.message : err
    );
    return null;
  }

  // Mindestens 5 Captions fuer vernuenftige Story. Unter dem Threshold
  // wuerde Gemini halluzinieren — lieber kein Backfill, Foreword nutzt
  // dann nur voiceProfile + bio.
  if (captions.length < 5) {
    console.warn(
      `[creator-story] backfill skipped: brand=${brand.slug} hat nur ${captions.length} Captions in DB`
    );
    return null;
  }

  let story: string;
  try {
    story = await analyzeCreatorStoryFromCaptions(captions, {
      username: brand.handle.replace(/^@/, ""),
      biography: brand.bio,
      voiceDescriptors: brand.voiceProfile?.toneDescriptors,
      forbiddenTopics: brand.voiceProfile?.forbiddenTopics,
    });
  } catch (err) {
    console.warn(
      `[creator-story] backfill failed for ${brand.slug}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }

  if (!story.trim()) {
    console.warn(`[creator-story] backfill produced empty story for ${brand.slug}`);
    return null;
  }

  // Persistierung. updateBrandCreatorStory handhabt Code-Brand-Stubs analog
  // zu updateBrandVoiceProfile.
  try {
    const { updateBrandCreatorStory } = await import("@/lib/custom-brands-server");
    await updateBrandCreatorStory(brand.slug, story);
    console.log(`[creator-story] backfilled + persisted for ${brand.slug}`);
  } catch (err) {
    console.log(
      `[creator-story] backfilled (in-memory only) for ${brand.slug}:`,
      err instanceof Error ? err.message : err
    );
  }

  return story;
}
