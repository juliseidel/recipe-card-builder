// Zentrale Banned-Phrases-Liste fuer alle KI-Text-Generierungen
// (Pack-Titel, Subtitle, Tagline, Description, Foreword-Text).
//
// Drei Ebenen:
//   1. GLOBAL_BANNED — Standard-KI-Floskeln, gelten fuer JEDEN Creator
//   2. STRUCTURAL_BANNED — Stilistische Verbote (Emojis, Em-Dash, Hashtags)
//   3. brand.voiceProfile.bannedPhrases — pro-Creator zusaetzliche Tabus
//
// Strategie: Wir checken Outputs gegen alle drei Ebenen. Treffer → Retry
// mit explizitem "AVOID: [...]"-Hinweis im Prompt, oder Kandidat wird
// im Multi-Candidate-Ranking abgewertet.

/** Klassische KI-/Marketing-Floskeln, die generisch klingen und in
 *  KEINEM Creator-Pack stehen sollten. Pflegen wir kuratiert hier —
 *  Erweiterung ueber die Zeit, je nachdem was wir in Outputs sehen. */
export const GLOBAL_BANNED_PHRASES: string[] = [
  // Marketing-Sprech
  "perfekt für jeden",
  "perfekte Sammlung",
  "perfekte Auswahl",
  "perfekte Wahl",
  "die besten",
  "die angesagtesten",
  "angesagteste",
  "must-have",
  "must have",
  "unverzichtbar",
  "köstliche Sammlung",
  "köstliche Auswahl",
  "Geschmackserlebnis",
  "Geschmacksexplosion",
  "wahre Gaumenfreude",
  "kulinarische Reise",
  "kulinarisches Highlight",
  "Trends nicht verpassen",
  "im Trend",
  "Trendige",
  "Lass dich inspirieren",
  "Inspiration pur",
  "Inspirationsquelle",
  "Genießen pur",
  "Genuss pur",
  "Geschmacksvielfalt",
  // KI-typische Wendungen
  "entdecke die",
  "tauche ein",
  "entführt dich",
  "verwöhne dich",
  "verzaubern",
  "verzauberndes",
  "schlemmen",
  "schwelgen",
  // Englisch-Floskeln, die in deutsche KI-Outputs leaken
  "delicious recipes",
  "must-try",
  "level up",
  "elevate your",
  "game-changer",
];

/** Struktur-Verbote: Emojis, Hashtags, Em-Dash, Anfuehrungszeichen.
 *  Werden als Regex gecheckt, nicht als Substring. */
export const STRUCTURAL_BANNED_PATTERNS: { pattern: RegExp; label: string }[] = [
  {
    pattern:
      // eslint-disable-next-line no-misleading-character-class
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u,
    label: "Emoji",
  },
  { pattern: /#\w+/, label: "Hashtag" },
  { pattern: /—/, label: "Em-Dash (—)" },
  { pattern: /["„«»"']/, label: "Anfuehrungszeichen" },
];

export type BannedHit = {
  phrase: string;
  label?: string;
};

/** Prueft einen Text gegen alle Ebenen. Returnt alle Treffer (case-
 *  insensitive). Leeres Array = sauber. */
export function findBannedPhrases(
  text: string,
  brandBannedPhrases: string[] = []
): BannedHit[] {
  const lower = text.toLowerCase();
  const hits: BannedHit[] = [];

  // Ebene 1 + 3: Substring-Match auf Global + Brand-spezifisch
  const allPhrases = [
    ...GLOBAL_BANNED_PHRASES,
    ...brandBannedPhrases.filter((p) => p.trim().length >= 3),
  ];
  for (const phrase of allPhrases) {
    if (lower.includes(phrase.toLowerCase())) {
      hits.push({ phrase });
    }
  }

  // Ebene 2: Strukturelle Patterns
  for (const { pattern, label } of STRUCTURAL_BANNED_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      hits.push({ phrase: match[0], label });
    }
  }

  return hits;
}

/** Baut einen Avoid-Hinweis fuer den Retry-Prompt: liste die Tabu-Worte
 *  + Default-Liste auf, damit Gemini gezielt umformuliert. */
export function buildAvoidHint(brandBannedPhrases: string[] = []): string {
  const combined = [
    ...new Set([...GLOBAL_BANNED_PHRASES, ...brandBannedPhrases]),
  ].slice(0, 40); // hard-cap damit Prompt nicht explodiert
  return `VERMEIDE diese Floskeln und Worte STRIKT:\n${combined.map((p) => `  - "${p}"`).join("\n")}\nVERMEIDE ausserdem: Emojis, Hashtags, Em-Dashes (—), Anfuehrungszeichen.`;
}

/** Quick-Check Helper fuer Pipelines, die nur boolean wollen. */
export function hasBannedContent(
  text: string,
  brandBannedPhrases: string[] = []
): boolean {
  return findBannedPhrases(text, brandBannedPhrases).length > 0;
}
