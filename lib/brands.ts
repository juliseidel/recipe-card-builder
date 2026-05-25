export type BrandTokens = {
  background: string;
  surface: string;
  ink: string;
  inkMuted: string;
  accent: string;
  accentSoft: string;
  line: string;
  signature: string;
};

export type BrandFonts = {
  display: string;
  body: string;
};

export type BrandStats = {
  followers: string;
  niche: string;
};

// Optionales Brand-DNA-Override fuer die Image-Pipeline. Code-Brands
// (Biene) haben ihre DNA in lib/ai/brand-image-style.ts hardgecodet —
// DB-Brands speichern dieselben Felder hier in brand.imageStyle, generiert
// von der Vision-Analyse beim Onboarding (PR 5).
//
// Schema identisch zu BrandImageStyle in lib/ai/brand-image-style.ts,
// ohne den brandSlug — der kommt aus brand.slug.
export type BrandImageStyleOverride = {
  lightingOptions: string[];
  sceneOptions: string[];
  styleSuffix: string;
  negativeAddition: string;
  cameraAesthetic: string;
  heroElementGuidance: string;
  defaultAngles?: Partial<
    Record<"flat" | "layered" | "tall" | "liquid" | "mixed", string>
  >;
};

/** Plattform-Identifier — welche Quelle wird beim Reel-Backfill,
 *  Recipe-Import und beim Daily-Refresh angesprochen. Code-Brands haben
 *  das Feld leer (Default = Instagram fuer Backward-Compat). */
export type BrandPlatform = "instagram" | "tiktok";

/** Audience-Insights aus dem Gemini-Analyzer (lib/ai/analyze-audience.ts).
 *  Wird im Onboarding generiert und im Workspace-Hero / spaeter im
 *  Pack-Suggester als Steuersignal genutzt. */
export type BrandAudienceAnalysis = {
  primaryDemographic: string;
  ageRange: string;
  genderTendency: string;
  interests: string[];
  painPoints: string[];
  contentStyle: string;
  tonality: string;
  summary: string;
};

/** Voice-Profil eines Creators — Tonalitaets-DNA aus den eigenen Reel-
 *  Captions abgeleitet (lib/ai/analyze-voice-profile.ts). Wird einmalig
 *  beim Onboarding erzeugt und in brand.data.voiceProfile persistiert.
 *  Alle Text-Generierungs-Pipelines (Pack-Titel, Description, Foreword)
 *  ziehen es als Steuersignal — damit klingen die Outputs nach DEM
 *  Creator, nicht nach generischer KI.
 *
 *  Brand-agnostisch: jeder neue Creator bekommt automatisch sein eigenes
 *  Profil. Code-Brands (Biene, Julia) ohne persistiertes Profil fallen
 *  auf hardgecodete Defaults zurueck — saubere Backward-Compat. */
export type BrandVoiceProfile = {
  /** Welche Anrede der Creator in Captions benutzt. "du" ist Default fuer
   *  Food/Fitness-Creator. */
  formality: "du" | "Sie" | "ihr";
  /** Hauptsprache der Captions. "mixed" wenn der Creator regelmaessig
   *  zwischen Sprachen wechselt (selten — meist eindeutig de oder en). */
  language: "de" | "en" | "mixed";
  /** Emoji-Frequenz in den Captions. Bestimmt ob die KI selber Emojis
   *  setzen darf (default: NIE in Pack-Metadaten, aber wir merken uns
   *  den Stil fuer ggf. spaetere Foreword-Texte). */
  emojiUsage: "none" | "sparse" | "frequent";
  /** 3-6 Adjektive, die die Stimme treffend beschreiben.
   *  Beispiele: ["warm", "ehrlich", "selbstironisch"] / ["sachlich",
   *  "knapp", "fakten-fokussiert"]. */
  toneDescriptors: string[];
  /** 4-8 Worte/Phrasen, die der Creator typisch nutzt — Vokabel-Anker.
   *  Beispiele: ["Schatz", "Bürotage", "Heißhunger"] / ["Hot Girl Walk",
   *  "Babe", "easy peasy"]. */
  signaturePhrases: string[];
  /** 3-8 brand-spezifische Tabu-Worte/Phrasen, die der Creator NIE
   *  benutzt. Beispiele Biene: ["Diät", "perfekt", "fit"]. Werden in den
   *  Banned-Phrases-Check additiv zur globalen Default-Liste reingegeben. */
  bannedPhrases: string[];
  /** Themen die der Creator nie behandelt. Verhindert Halluzinationen
   *  wie "before/after"-Vergleiche, extreme Diäten, Kalorien-Shaming.
   *  Beispiele: ["before/after", "Kalorienzählen", "Verzicht"]. */
  forbiddenTopics: string[];
  /** 3-5 echte Caption-Auszüge (full text, max 400 chars) als Few-Shot.
   *  Werden in jedem Pack-Text-Prompt mit-gezeigt: "So schreibt diese
   *  Person — orientiere dich am Stil, nicht am Inhalt." Das ist der
   *  größte Hebel gegen KI-Sound. */
  captionExamples: string[];
  /** Wann das Profil zuletzt aktualisiert wurde (ISO8601). Refresh nach
   *  ~90 Tagen sinnvoll, weil Creator-Stil sich entwickeln kann. */
  updatedAt: string;
};

export type Brand = {
  slug: string;
  name: string;
  fullName: string;
  handle: string;
  bio: string;
  tagline: string;
  signature: string;
  /** Geschlecht des Creators. Steuert die Anrede-Form ("Dein Martin" vs
   *  "Deine Julia") wenn die signature dem Standard-Pattern folgt. Wird
   *  beim Brand-Onboarding via Gemini abgeleitet (analyze-creator-identity).
   *  Optional fuer Backward-Compat mit Bestands-Brands ohne gender-Feld. */
  gender?: "male" | "female" | "neutral";
  avatar: string;
  stats: BrandStats;
  tokens: BrandTokens;
  fonts: BrandFonts;
  packCount: number;
  recipeCount: number;
  /** Per-Brand Image-Pipeline-DNA. Bei Code-Brand (Biene) leer — Style
   *  liegt in lib/ai/brand-image-style.ts. Bei DB-Brands von der Vision-
   *  Analyse der letzten Reel-Covers generiert und hier persistiert. */
  imageStyle?: BrandImageStyleOverride;
  /** Quelle des Creators — Instagram oder TikTok. Default 'instagram'
   *  fuer Backward-Compat mit bestehenden Brands. */
  platform?: BrandPlatform;
  /** Audience-Insights aus dem KI-Analyzer beim Onboarding. Wird optional
   *  in der Workspace-UI gezeigt und kann vom Pack-Suggester genutzt
   *  werden, um Vorschlaege auf die echte Zielgruppe zu kalibrieren. */
  audienceAnalysis?: BrandAudienceAnalysis;
  /** Tonalitaets-DNA aus den eigenen Reel-Captions. Wird beim Onboarding
   *  einmalig generiert (lib/ai/analyze-voice-profile.ts) und von allen
   *  Text-Generierungs-Pipelines als Steuersignal genutzt. Code-Brands
   *  ohne Profil fallen auf bio/tagline-basierte Defaults zurueck. */
  voiceProfile?: BrandVoiceProfile;
  /** Persoenliche Lebens-/Themen-Story des Creators: 5-10 Saetze ueber
   *  Werdegang, Wendepunkt, warum kocht er/sie was er/sie kocht. Wird
   *  beim Onboarding einmalig aus Bio + Top-Reel-Captions + Voice-Profile
   *  via Gemini Pro destilliert (lib/ai/analyze-creator-story.ts) und in
   *  brand.data.creatorStory persistiert. Speist sich in den Foreword-
   *  Generator ein, damit Vorworte nicht generisch klingen, sondern
   *  echte Persoenlichkeit transportieren. Code-Brands ohne Story
   *  fallen auf bio/tagline-basierte Defaults zurueck. */
  creatorStory?: string;
  /** Welcher Pack-Type ist Default fuer diesen Brand. "recipe" (Default)
   *  = Rezepte-Workspace; "fitness" = Trainings-Workspace. Steuert welche
   *  Pipeline bei Karten-Anlage laeuft (Hero-Generation, Klassifikator,
   *  PDF-Layouts). Per-Pack ueberschreibbar via Pack.packType.
   *  Optional fuer Backward-Compat — Bestands-Brands ohne Feld werden als
   *  "recipe" interpretiert. */
  defaultPackType?: "recipe" | "fitness";
  /** Default-Pack-Modus fuer diesen Brand. "recipebook" (Default) =
   *  klassischer Rezept-Pack ohne Story-Seiten. "guide" = mit 2-4 Story-
   *  Seiten zur Person (Werdegang, Philosophie etc.). Per-Pack ueber-
   *  schreibbar via Pack.packMode. Niklas-Wunsch: manche Creator
   *  (Biene-Stil) wollen Guide, andere (Julia-Stil) nicht. */
  defaultPackMode?: "recipebook" | "guide";
};

export const brands: Brand[] = [
  {
    slug: "biene",
    name: "Biene",
    fullName: "Sabrina Mirella Börke",
    handle: "@bienesfitlife",
    bio: "−20 kg abgenommen · einfache Abnehm-Rezepte ohne Verzicht · High-Protein, fluffig, cremig — und für jeden machbar.",
    tagline: "Abnehmen ohne Verzicht",
    signature: "Deine Biene",
    avatar: "/brands/biene/avatar.jpg",
    stats: {
      followers: "819K",
      niche: "Fitness · Food · MORE Nutrition",
    },
    tokens: {
      background: "#fbf7f0",
      surface: "#ffffff",
      ink: "#2b1f19",
      inkMuted: "#6b5444",
      accent: "#e8889b",
      accentSoft: "#fde8ee",
      line: "#efe6d6",
      signature: "#f4c44a",
    },
    fonts: {
      display: "var(--font-fraunces)",
      body: "var(--font-inter)",
    },
    packCount: 5,
    recipeCount: 37,
  },
];

export function getBrand(slug: string): Brand | undefined {
  return brands.find((brand) => brand.slug === slug);
}

// Sagt: ist dieser Slug ein Code-Brand (z. B. Biene)? Wird vom UI
// gebraucht, um Aktionen (z. B. "Brand-Style aktualisieren") auf DB-
// Brands zu beschraenken — Code-Brand-Styles liegen im Code und duerfen
// nicht ueber den Regenerate-Endpoint ueberschrieben werden.
export function isCodeBrand(slug: string): boolean {
  return brands.some((b) => b.slug === slug);
}

// Alle Code-Brands mit gueltigem Social-Handle. Wird vom Daily-Refresh-
// Cron und vom Reel-Refresh-Endpoint genutzt: auch Biene & Co. muessen
// regelmaessig neue Reels nachziehen, obwohl ihr Profil im Code liegt
// und nicht in der brands-Tabelle. Filter: handle muss gesetzt sein,
// "@creator" / leer wird ausgeschlossen.
export function getCodeBrandsWithHandle(): Brand[] {
  return brands.filter((b) => {
    const handle = b.handle?.replace(/^@+/, "").trim();
    return Boolean(handle) && handle !== "creator";
  });
}
