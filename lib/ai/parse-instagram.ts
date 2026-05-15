import { callGemini } from "./gemini";
import type {
  Ingredient,
  NutritionBasis,
  RecipeStep,
} from "@/lib/recipes";
import type { Brand } from "@/lib/brands";
import {
  formatVoiceProfileForPrompt,
  formatCaptionFewShot,
  ensureBrandVoiceProfile,
} from "./analyze-voice-profile";

// Was wir aus einer Instagram-Caption extrahieren wollen. Spiegelt die Felder
// des Editor-Forms (app/[brand]/[pack]/new/page.tsx) — alles, was der User
// eintippen würde, soll Gemini füllen können, plus ein Confidence-Signal,
// damit die UI dem Nutzer zeigen kann, wie sicher die KI war.
export type ParsedInstagramRecipe = {
  title: string;
  subtitle: string;
  description: string;
  prepTime: number;
  cookTime: number | null;
  difficulty: "Einfach" | "Mittel" | "Aufwendig";
  servings: number;
  tags: string[];
  ingredients: Ingredient[];
  steps: RecipeStep[];
  nutrition: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  nutritionBasis: NutritionBasis;
  /** Wie sicher Gemini sich beim Parsen war. low = kaum erkennbar. */
  confidence: "high" | "medium" | "low";
  /** Eine kurze Erklärung für den User, was nicht oder unklar erkannt wurde. */
  notes: string | null;
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description:
        "Kurzer, klarer Rezept-Titel. Wenn der erste Satz der Caption der Titel ist, nutze ihn — schneide aber Emojis und Hashtags ab. Falls kein klarer Titel: leerer String.",
    },
    subtitle: {
      type: "string",
      description:
        "Optionaler Untertitel, max ~60 Zeichen. Z. B. 'Cremig, fluffig, 380 kcal' oder 'Mealprep-tauglich'. Falls nichts erkennbar: leerer String.",
    },
    description: {
      type: "string",
      description:
        "1-3 Saetze persoenliche Story / Beschreibung aus der Caption. Klingt nach dem Creator (Bienes Tonalitaet: warm, du-Form). Keine Hashtag-Salven, keine Affiliate-Codes. Falls nichts: leerer String.",
    },
    prepTime: {
      type: "integer",
      description:
        "Vorbereitungszeit in Minuten. Wenn Caption 'in 15 min' sagt, nutze 15. Wenn unklar: 15 als Standard.",
    },
    cookTime: {
      type: "integer",
      description:
        "Garzeit / Backzeit in Minuten. -1 wenn nicht vorhanden / unklar.",
    },
    difficulty: {
      type: "string",
      enum: ["Einfach", "Mittel", "Aufwendig"],
      description:
        "Schwierigkeitsgrad. 'Einfach' bei <=6 Schritten und Standard-Zutaten. 'Aufwendig' nur bei langen, komplexen Rezepten mit Sondertechniken.",
    },
    servings: {
      type: "integer",
      description:
        "Anzahl Portionen / Stück. Wenn 'für 12 Cookies' → 12. Wenn 'für 2 Personen' → 2. Default 2.",
    },
    tags: {
      type: "array",
      items: { type: "string" },
      description:
        "3-6 thematische Tags auf Deutsch, kurz (1-2 Woerter). Beispiele: 'High Protein', 'Ohne Backen', 'Mealprep', 'Glutenfrei', 'Vegan', 'Schnell'. Keine Hashtags mit #-Prefix.",
    },
    ingredients: {
      type: "array",
      description:
        "Alle Zutaten in der Reihenfolge der Caption. Bei Sub-Gruppen ('Fuer den Teig:', 'Fuer die Glasur:') das group-Feld setzen. Hauptzutaten ohne group.",
      items: {
        type: "object",
        properties: {
          amount: {
            type: "string",
            description:
              "Menge mit Einheit, z. B. '200 g', '1 EL', '2 Stück'. Bei unklarer Menge 'n. A.'",
          },
          name: {
            type: "string",
            description:
              "Zutaten-Name auf Deutsch, ohne Marke wenn moeglich (Ausnahme: 'MORE Sahne Protein' bleibt, weil markenspezifisch).",
          },
          group: {
            type: "string",
            description:
              "Optionale Sub-Gruppe wie 'Fuer den Teig', 'Glasur', 'Topping'. Leer lassen wenn die Zutat zur Hauptliste gehoert.",
          },
        },
        required: ["amount", "name"],
      },
    },
    steps: {
      type: "array",
      description:
        "Zubereitungsschritte in Reihenfolge. Jeder Schritt ein verstaendlicher Satz. Bei Sub-Gruppen ('Fuer die Glasur') analog zur Zutaten-Logik gruppieren.",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          group: {
            type: "string",
            description: "Optionale Sub-Gruppe.",
          },
        },
        required: ["text"],
      },
    },
    kcal: {
      type: "integer",
      description:
        "Kalorien — falls in Caption genannt (z. B. '✅ 394 kcal'). 0 wenn nicht erkennbar.",
    },
    protein: {
      type: "integer",
      description:
        "Eiweiss in Gramm. 0 wenn nicht erkennbar.",
    },
    carbs: {
      type: "integer",
      description:
        "Kohlenhydrate in Gramm. 0 wenn nicht erkennbar.",
    },
    fat: {
      type: "integer",
      description: "Fett in Gramm. 0 wenn nicht erkennbar.",
    },
    nutritionBasis: {
      type: "string",
      enum: ["portion", "piece", "per100g", "total"],
      description:
        "Worauf beziehen sich die Nährwerte. 'portion' = pro Portion, 'piece' = pro Stück (z. B. Cookie/Muffin), 'per100g' = pro 100 g, 'total' = gesamtes Rezept.",
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description:
        "Wie sicher du dir beim Parsen bist. 'high' = klare Liste mit Mengen + Schritten. 'medium' = Rezept erkennbar aber Lücken. 'low' = kein eindeutiges Rezept in der Caption.",
    },
    notes: {
      type: "string",
      description:
        "1 Satz für den User, was nicht / unklar erkennbar war. Z. B. 'Nährwerte fehlen in der Caption — bitte ergänzen.'. Leerer String wenn alles klar.",
    },
  },
  required: [
    "title",
    "subtitle",
    "description",
    "prepTime",
    "cookTime",
    "difficulty",
    "servings",
    "tags",
    "ingredients",
    "steps",
    "kcal",
    "protein",
    "carbs",
    "fat",
    "nutritionBasis",
    "confidence",
    "notes",
  ],
};

function buildSystemInstruction(brand?: Brand | null): string {
  const brandLine = brand
    ? `Quelle: ${brand.name} (${brand.handle}). Bio: "${brand.bio}".`
    : "";
  const voiceBlock = brand
    ? formatVoiceProfileForPrompt(brand.voiceProfile, brand.name)
    : "";
  const fewShotBlock = brand
    ? formatCaptionFewShot(brand.voiceProfile)
    : "";

  // Sprache aus voiceProfile ableiten, default Deutsch wenn unklar. So
  // funktioniert der Parser auch fuer englischsprachige Creator ohne dass
  // er Captions in falsche Zielsprache uebersetzt.
  const lang = brand?.voiceProfile?.language;
  const langName = lang === "en" ? "Englisch" : "Deutsch";
  const langCode = lang === "en" ? "en" : "de";

  return `Du bist ein praeziser Rezept-Parser fuer Social-Media-Captions von Food-Creatorn — egal welche Plattform oder Nische.

${brandLine}

${voiceBlock}

${fewShotBlock}

Deine Aufgabe: Aus der Caption ein vollstaendiges, druckfertiges Rezept extrahieren — strukturiert nach dem JSON-Schema.

Regeln:
• ALLES auf ${langName} (${langCode}) — Zutaten, Schritte, Tags, Beschreibung. Auch wenn Caption andere Sprachen sprenkelt.
• MENGEN exakt aus der Caption uebernehmen ('200 g', '1 EL', '2 Eier'). Wenn unklar: 'n. A.'
• Schritte als kurze, klare Saetze, gerne imperativ (z. B. 'Vermische die Zutaten' bei Du-Form, 'Mix the ingredients' im Englischen).
• Hashtags und Affiliate-Codes NICHT in description — die gehoeren weg.
• Naehrwerte aus Caption uebernehmen ('✅ 394 kcal · 31g Protein'). Wenn nicht da: alle 0 + notes-Hinweis.
• nutritionBasis: 'piece' bei Backwerk wo pro Stueck angegeben (Cookie, Muffin, Pancake). 'portion' default. 'per100g' wenn explizit '/100 g'.
• Tags: 3-6 thematische Schlagworte (z. B. 'High Protein', 'Mealprep', 'Ohne Backen', 'Low Carb'). NIE mit '#'-Prefix. Marken nur wenn relevant (Marken-Erwaehnung in Caption ist KEIN Tag — nur thematische Schlagworte).
• subtitle: nur wenn die Caption einen offensichtlichen Untertitel hat. Sonst leer.
• description: 1-3 Saetze im Stil des Creators (siehe Voice-Profil oben). Wenn kein Voice-Profil verfuegbar: warm, persoenlich, du-Form, ohne Hashtag-Salat.
• Sub-Gruppen ('Fuer den Teig:', 'Fuer die Glasur:', 'For the dough:'): explizit als group-Feld bei Zutaten UND Schritten markieren.
• KONSISTENZ (wichtig!): Jede Zutat in 'ingredients' MUSS irgendwo im Rezept-Ablauf vorkommen — entweder direkt namentlich in einem Schritt-Text, oder implizit als Teil von 'Alle trockenen Zutaten vermengen'. Wenn eine Zutat weder explizit noch implizit verwendet wird, lass sie weg. Niemals Geister-Zutaten zurueckgeben.
• confidence:
  - 'high' wenn klare Zutatenliste + nummerierte Schritte + Naehrwerte
  - 'medium' wenn Rezept erkennbar aber Luecken (z. B. keine Naehrwerte)
  - 'low' wenn die Caption ueberwiegend Story / Werbung ist und kaum Rezept-Info
• Antworte AUSSCHLIESSLICH im JSON-Schema — keine Erklaerungen davor oder dahinter.`;
}

const URL_REGEX = /https?:\/\/[^\s)]+/g;
const HASHTAG_LINE_REGEX = /(^|\n)\s*(?:#\w+\s*)+(?:\n|$)/g;

// Bereinigt die Caption vor dem Schicken an Gemini: Hashtag-Bloecke am Ende
// rauswerfen (oft 30+ Hashtags), URLs entfernen, doppelte Newlines einkuerzen.
// Spart Tokens und macht das Modell fokussierter aufs Rezept.
function preprocessCaption(raw: string): string {
  let s = raw.trim();
  s = s.replace(URL_REGEX, "");
  s = s.replace(HASHTAG_LINE_REGEX, "\n");
  // Zusammenhaengende Hashtag-Bloecke mitten im Text auch reduzieren
  s = s.replace(/(#\w+\s*){5,}/g, "");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

export type ParseResult =
  | {
      ok: true;
      recipe: ParsedInstagramRecipe;
      /** Hinweis aus dem Konsistenz-Pass, falls etwas korrigiert wurde. */
      reconciliation: string | null;
    }
  | { ok: false; error: string };

export async function parseRecipeFromCaption(
  caption: string,
  options?: { username?: string | null; brand?: Brand | null }
): Promise<ParseResult> {
  const cleaned = preprocessCaption(caption);
  if (cleaned.length < 30) {
    return {
      ok: false,
      error:
        "Caption zu kurz für ein Rezept. Wahrscheinlich nur Story / Bildunterschrift.",
    };
  }

  // Brand mit Voice-Profil lazy laden falls noetig — gibt Gemini die richtige
  // Tonalitaet fuer die Description-Generierung mit.
  const brandWithVoice = options?.brand
    ? ((await ensureBrandVoiceProfile(options.brand)) ?? options.brand)
    : null;

  const userHint = options?.username
    ? `Quelle: @${options.username} auf Instagram.\n\n`
    : "";

  const prompt = `${userHint}Caption (zu parsen):\n\n${cleaned}\n\nExtrahiere das Rezept gemaess Schema. Wenn kein Rezept erkennbar: confidence='low' setzen und so viel wie moeglich aus der Caption mitnehmen.`;

  let raw: RawGeminiResponse;
  try {
    raw = await callGemini<RawGeminiResponse>({
      prompt,
      schema: RESPONSE_SCHEMA,
      systemInstruction: buildSystemInstruction(brandWithVoice),
      temperature: 0.2,
      maxOutputTokens: 8192,
      thinkingBudget: 0,
      retries: 2,
    });
  } catch (err) {
    return {
      ok: false,
      error: `KI-Parsing fehlgeschlagen: ${(err as Error).message}`,
    };
  }

  const parsed = normalizeParsed(raw);

  // Konsistenz-Pass: orphan-Zutaten (z. B. "MORE Zerup" ohne Step-Verwendung)
  // entfernen oder in passenden Schritt einbauen. Best-effort — wenn der Pass
  // selber failt, geben wir das Rohrezept zurueck, ohne den Import zu blocken.
  const reconciled = await reconcileConsistency(parsed);
  return {
    ok: true,
    recipe: reconciled.recipe,
    reconciliation: reconciled.summary,
  };
}

// ─── Konsistenz-Pass (zweiter Gemini-Call) ──────────────────────────────────
// Ingo-Feedback: Im ersten Import landete "MORE Zerup" als Zutat im Rezept,
// obwohl der Sirup in keinem Schritt verwendet wurde. Der primary parse
// hatte das geistige Modell "Caption nennt Zutat, also liste sie", ohne
// den Workflow zu prüfen. Dieser zweite Pass fragt Gemini gezielt nach
// Inkonsistenzen und gibt eine bereinigte Version zurück.

const RECONCILE_SCHEMA = {
  type: "object",
  properties: {
    needsFix: {
      type: "boolean",
      description:
        "true, wenn Zutaten korrigiert werden mussten. false wenn alles konsistent war.",
    },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          amount: { type: "string" },
          name: { type: "string" },
          group: { type: "string" },
        },
        required: ["amount", "name"],
      },
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          group: { type: "string" },
        },
        required: ["text"],
      },
    },
    summary: {
      type: "string",
      description:
        "Kurzer Hinweis fuer den User, was geaendert wurde — z. B. '1 unbenutzte Zutat entfernt: MORE Zerup.' oder '2 Zutaten in Schritt 3 ergaenzt.'. Leerer String wenn keine Aenderung.",
    },
  },
  required: ["needsFix", "ingredients", "steps", "summary"],
};

const RECONCILE_SYSTEM = `Du pruefst Rezept-Konsistenz: jede Zutat MUSS im Workflow vorkommen — entweder explizit namentlich in einem Schritt, oder implizit ueber Catch-Alls ('Alle trockenen Zutaten vermengen.', 'Alle Zutaten in den Mixer geben.', 'Fuer die Glasur alles verruehren.').

Eingabe: ein Rezept mit Zutatenliste + Schritten.

Aufgabe: identifiziere Geister-Zutaten (Zutaten, die weder explizit noch implizit im Workflow vorkommen) und behandle sie nach Prioritaet:
1. Wenn die Zutat sinnvoll in einen bestehenden Schritt eingebaut werden kann (z. B. 'Topping zum Servieren') → ergaenze einen Schritt oder erweitere einen bestehenden.
2. Wenn die Zutat redundant/aus Versehen aufgelistet wirkt → entferne sie aus der Liste.

Gib das **vollstaendige korrigierte** ingredients- und steps-Array zurueck (gleiches Format wie Eingabe). Wenn nichts zu fixen war: needsFix=false und Listen unveraendert weitergeben.

summary: ein deutscher Satz fuer den User. Bei Aenderung konkret nennen, was passiert ist. Bei needsFix=false: leerer String.

Antworte AUSSCHLIESSLICH im JSON-Schema.`;

async function reconcileConsistency(
  recipe: ParsedInstagramRecipe
): Promise<{ recipe: ParsedInstagramRecipe; summary: string | null }> {
  // Wenn das Rezept gar keine Schritte oder Zutaten hat, lohnt sich der Call
  // nicht — der primary parse hat eh schon eine Lücke gemeldet (low confidence).
  if (recipe.ingredients.length === 0 || recipe.steps.length === 0) {
    return { recipe, summary: null };
  }

  const payload = {
    ingredients: recipe.ingredients.map((i) => ({
      amount: i.amount,
      name: i.name,
      ...(i.group ? { group: i.group } : {}),
    })),
    steps: recipe.steps.map((s) => ({
      text: s.text,
      ...(s.group ? { group: s.group } : {}),
    })),
  };

  try {
    const raw = await callGemini<{
      needsFix: boolean;
      ingredients: Array<{ amount: string; name: string; group?: string }>;
      steps: Array<{ text: string; group?: string }>;
      summary: string;
    }>({
      prompt: `Rezept zur Konsistenz-Pruefung:\n\n${JSON.stringify(payload, null, 2)}`,
      schema: RECONCILE_SCHEMA,
      systemInstruction: RECONCILE_SYSTEM,
      temperature: 0.1,
      maxOutputTokens: 4096,
      thinkingBudget: 0,
      retries: 1,
    });

    if (!raw.needsFix || !raw.summary?.trim()) {
      return { recipe, summary: null };
    }

    const fixedIngredients: Ingredient[] = (raw.ingredients ?? [])
      .filter((i) => i?.name?.trim())
      .map((i) => ({
        amount: (i.amount ?? "").trim() || "n. A.",
        name: i.name.trim(),
        ...(i.group?.trim() ? { group: i.group.trim() } : {}),
      }));

    const fixedSteps: RecipeStep[] = (raw.steps ?? [])
      .filter((s) => s?.text?.trim())
      .map((s) => ({
        text: s.text.trim(),
        ...(s.group?.trim() ? { group: s.group.trim() } : {}),
      }));

    // Defensive: wenn der Reconciliation-Pass die Listen komplett leerraeumt
    // (sehr unwahrscheinlich, aber Gemini), behalten wir das Original.
    if (fixedIngredients.length === 0 || fixedSteps.length === 0) {
      return { recipe, summary: null };
    }

    return {
      recipe: {
        ...recipe,
        ingredients: fixedIngredients,
        steps: fixedSteps,
      },
      summary: raw.summary.trim(),
    };
  } catch {
    // Best-effort: bei Fehler einfach das unkorrigierte Rezept zurueckgeben,
    // damit der Import-Flow weiterlaeuft. Inkonsistenz ist weniger schlimm
    // als ein komplett geblocktes Rezept.
    return { recipe, summary: null };
  }
}

// Roh-Antwort von Gemini — flach (kcal/protein/... statt nutrition.kcal),
// damit das JSON-Schema simpler bleibt. Wir bauen nutrition selbst auf.
type RawGeminiResponse = {
  title: string;
  subtitle: string;
  description: string;
  prepTime: number;
  cookTime: number;
  difficulty: string;
  servings: number;
  tags: string[];
  ingredients: Array<{ amount: string; name: string; group?: string }>;
  steps: Array<{ text: string; group?: string }>;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  nutritionBasis: string;
  confidence: string;
  notes: string;
};

function normalizeParsed(raw: RawGeminiResponse): ParsedInstagramRecipe {
  // cookTime: Schema-Konvention -1 = nicht vorhanden → null im UI
  const cookTime =
    raw.cookTime && raw.cookTime > 0 ? Math.floor(raw.cookTime) : null;

  // Difficulty: Gemini kann manchmal Varianten zurückgeben, defensiv eingrenzen
  const difficulty: "Einfach" | "Mittel" | "Aufwendig" = (
    ["Einfach", "Mittel", "Aufwendig"] as const
  ).includes(raw.difficulty as never)
    ? (raw.difficulty as "Einfach" | "Mittel" | "Aufwendig")
    : "Einfach";

  const nutritionBasis: NutritionBasis = (
    ["portion", "piece", "per100g", "total"] as const
  ).includes(raw.nutritionBasis as never)
    ? (raw.nutritionBasis as NutritionBasis)
    : "portion";

  const confidence: "high" | "medium" | "low" = (
    ["high", "medium", "low"] as const
  ).includes(raw.confidence as never)
    ? (raw.confidence as "high" | "medium" | "low")
    : "low";

  // Zutaten + Steps: leere Eintraege rausfiltern, group nur wenn nicht leer
  const ingredients: Ingredient[] = (raw.ingredients ?? [])
    .filter((i) => i?.name?.trim())
    .map((i) => ({
      amount: (i.amount ?? "").trim() || "n. A.",
      name: i.name.trim(),
      ...(i.group?.trim() ? { group: i.group.trim() } : {}),
    }));

  const steps: RecipeStep[] = (raw.steps ?? [])
    .filter((s) => s?.text?.trim())
    .map((s) => ({
      text: s.text.trim(),
      ...(s.group?.trim() ? { group: s.group.trim() } : {}),
    }));

  // Tags: Hashtag-Prefix abschneiden, dedupe, max 6
  const tagSeen = new Set<string>();
  const tags = (raw.tags ?? [])
    .map((t) => (t ?? "").replace(/^#/, "").trim())
    .filter((t) => {
      if (!t) return false;
      const key = t.toLowerCase();
      if (tagSeen.has(key)) return false;
      tagSeen.add(key);
      return true;
    })
    .slice(0, 6);

  return {
    title: (raw.title ?? "").trim(),
    subtitle: (raw.subtitle ?? "").trim(),
    description: (raw.description ?? "").trim(),
    prepTime: Math.max(0, Math.floor(raw.prepTime ?? 15) || 15),
    cookTime,
    difficulty,
    servings: Math.max(1, Math.floor(raw.servings ?? 2) || 2),
    tags,
    ingredients,
    steps,
    nutrition: {
      kcal: Math.max(0, Math.floor(raw.kcal ?? 0)),
      protein: Math.max(0, Math.floor(raw.protein ?? 0)),
      carbs: Math.max(0, Math.floor(raw.carbs ?? 0)),
      fat: Math.max(0, Math.floor(raw.fat ?? 0)),
    },
    nutritionBasis,
    confidence,
    notes: (raw.notes ?? "").trim() || null,
  };
}
