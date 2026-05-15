import { callGemini, type GeminiSchema } from "./gemini";
import {
  findBannedPhrases,
  buildAvoidHint,
  type BannedHit,
} from "./banned-phrases";

// Generic Multi-Candidate + Self-Critique Pipeline.
//
// Strategie gegen "manchmal Quatsch, manchmal gut" und gegen den
// generischen KI-Sound:
//   1. GENERIERE N Kandidaten parallel (default 3), mit hoeherer
//      Temperatur als Single-Shot, damit echte Vielfalt entsteht.
//   2. PRUEFE jeden Kandidaten gegen Banned-Phrases. Treffer → markieren.
//   3. RANKE die Kandidaten via Self-Critique-Call (Gemini Flash bekommt
//      alle N Kandidaten + harte Kriterien, gibt einen Score je Kandidat).
//   4. WAEHLE Top-Score-Kandidat ohne Banned-Hits. Fallback: Best ohne
//      Hits via Banned-Filter, dann Best ueberhaupt.
//   5. Bei keinem sauberen Kandidaten: RETRY-Pass mit explizitem
//      "AVOID:"-Hint im Prompt.
//
// Brand-agnostisch: alle Bewertungs-Kriterien werden vom Caller
// uebergeben, keine Biene-hardcoded Heuristiken.

export type TextFieldSpec = {
  /** JSON-Property-Name des Feldes (z.B. "title", "description"). */
  key: string;
  /** Menschlich verstaendliche Bezeichnung fuer den Critic-Prompt. */
  label: string;
  /** Minimum + Maximum Laenge in chars. Outside → Punktabzug im Score. */
  minLength?: number;
  maxLength: number;
  /** Was zeichnet einen GUTEN Wert in diesem Feld aus? Free-form,
   *  wird dem Critic in den Prompt gegeben. */
  goodCriteria: string;
};

export type CandidatePipelineOptions<TCandidate> = {
  /** Was ist der Output-Typ. Schema bleibt unangetastet — sieht aus wie
   *  beim normalen callGemini-Call. */
  schema: GeminiSchema;
  /** Generation-Prompt. Wird N-mal mit verschiedenen Temperaturen
   *  gesampled fuer Diversitaet. */
  generationPrompt: string;
  generationSystemInstruction: string;
  /** Wie viele Kandidaten? Default 3. */
  candidateCount?: number;
  /** Temperatur fuer Generation. Hoeher als Single-Shot, damit die
   *  Kandidaten wirklich unterschiedlich sind. Default 0.75. */
  generationTemperature?: number;
  maxOutputTokens?: number;
  /** Schema-Felder, die bewertet werden. Critic checkt diese. */
  scorableFields: TextFieldSpec[];
  /** Optional: brand-spezifische Banned-Phrases additiv zur Default-Liste. */
  brandBannedPhrases?: string[];
  /** Optional: Vor-Validator. Returns true wenn Kandidat technisch
   *  invalide ist (z.B. enum-Verstoss). Wird vor dem Critic gefiltert. */
  preFilter?: (candidate: TCandidate) => boolean;
  /** Welche Strings sollen aus dem Kandidaten gegen die Banned-Liste
   *  geprueft werden? Concat der genannten Felder. */
  bannedCheckFields: (keyof TCandidate & string)[];
  /** Optional Debug-Tag (landet in console.log fuer das Tracing). */
  debugTag?: string;
};

export type CandidatePipelineResult<TCandidate> = {
  winner: TCandidate;
  /** Wie viele Kandidaten waren sauber (ohne Banned-Hits)? */
  cleanCount: number;
  /** Wie viele Generation-Pass-Iterationen wurden gemacht (1 oder 2)? */
  passes: number;
  /** Banned-Hits im Winner — sollte leer sein, ist es nicht wenn alle
   *  Kandidaten Hits hatten und wir notgedrungen den besten genommen haben. */
  winnerBannedHits: BannedHit[];
};

const CRITIC_SCHEMA = {
  type: "object",
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        properties: {
          candidateIndex: { type: "integer" },
          overallScore: {
            type: "number",
            description: "0..10 Gesamtbewertung — wie gut ist der Kandidat ueber alle Kriterien?",
          },
          fieldScores: {
            type: "array",
            items: {
              type: "object",
              properties: {
                fieldKey: { type: "string" },
                score: {
                  type: "number",
                  description: "0..10 fuer dieses Einzelfeld.",
                },
                issue: {
                  type: "string",
                  description: "Falls Score < 7: kurzer Hinweis was nicht stimmt. Sonst leerer String.",
                },
              },
              required: ["fieldKey", "score", "issue"],
            },
          },
          soundsLikeAi: {
            type: "boolean",
            description: "True wenn der Output generisch klingt, wie KI-Marketing-Text. False wenn er natuerlich klingt.",
          },
          notes: {
            type: "string",
            description: "1-2 Saetze Begruendung fuer den Overall-Score.",
          },
        },
        required: [
          "candidateIndex",
          "overallScore",
          "fieldScores",
          "soundsLikeAi",
          "notes",
        ],
      },
    },
    bestIndex: {
      type: "integer",
      description: "Index des besten Kandidaten (0-basiert).",
    },
  },
  required: ["scores", "bestIndex"],
};

type CriticResponse = {
  scores: Array<{
    candidateIndex: number;
    overallScore: number;
    fieldScores: Array<{
      fieldKey: string;
      score: number;
      issue: string;
    }>;
    soundsLikeAi: boolean;
    notes: string;
  }>;
  bestIndex: number;
};

function buildCriticPrompt<T>(
  candidates: T[],
  opts: CandidatePipelineOptions<T>
): string {
  const fieldRules = opts.scorableFields
    .map((f) => {
      const lengthRule = f.minLength
        ? `Laenge ${f.minLength}-${f.maxLength} chars`
        : `max ${f.maxLength} chars`;
      return `- ${f.label} (${f.key}): ${f.goodCriteria}. ${lengthRule}.`;
    })
    .join("\n");

  const candidateBlocks = candidates
    .map((c, i) => {
      const pretty = opts.scorableFields
        .map((f) => `  ${f.label} (${f.key}): ${(c as Record<string, unknown>)[f.key] ?? "(leer)"}`)
        .join("\n");
      return `--- Kandidat ${i} ---\n${pretty}`;
    })
    .join("\n\n");

  return `Du bewertest ${candidates.length} Kandidaten-Vorschlaege fuer einen Recipe-Pack.

KRITERIEN:
${fieldRules}

BEWERTUNGS-REGELN:
- 0-3 = klingt klar nach generischer KI (Marketing-Floskel, austauschbar, hat Schreibfehler, falsche Laenge)
- 4-6 = okay aber unauffaellig (kein klarer Stil, koennte besser sein)
- 7-8 = gut, klingt natuerlich, hat Persoenlichkeit
- 9-10 = exzellent, klingt genau wie ein erfahrener Creator selber schreiben wuerde

WICHTIG: "soundsLikeAi" = true ist ein TOTAL-K.O. — selbst wenn andere Kriterien gut aussehen, bedeutet KI-Klang dass der Text generisch ist und nicht zur Brand passt.

KANDIDATEN:

${candidateBlocks}

Score jeden Kandidaten und nominiere bestIndex (den mit dem hoechsten overallScore). JSON-Schema einhalten.`;
}

/** Vergleicht den Output mit der Banned-List und filtert. */
function getBannedHitsForCandidate<T>(
  candidate: T,
  fields: (keyof T & string)[],
  brandBannedPhrases: string[]
): BannedHit[] {
  const combinedText = fields
    .map((f) => String((candidate as Record<string, unknown>)[f] ?? ""))
    .join(" \n ");
  return findBannedPhrases(combinedText, brandBannedPhrases);
}

export async function generateWithCritique<TCandidate>(
  opts: CandidatePipelineOptions<TCandidate>
): Promise<CandidatePipelineResult<TCandidate>> {
  const candidateCount = opts.candidateCount ?? 3;
  const baseTemp = opts.generationTemperature ?? 0.75;

  async function generatePass(extraInstruction: string): Promise<TCandidate[]> {
    const temps = Array.from({ length: candidateCount }, (_, i) => {
      // Spread temperatures fuer echte Diversitaet: 0.6 / 0.75 / 0.9
      const offset = (i - (candidateCount - 1) / 2) * 0.15;
      return Math.max(0.3, Math.min(1.2, baseTemp + offset));
    });

    const fullSystem = extraInstruction
      ? `${opts.generationSystemInstruction}\n\n${extraInstruction}`
      : opts.generationSystemInstruction;

    const results = await Promise.allSettled(
      temps.map((t) =>
        callGemini<TCandidate>({
          prompt: opts.generationPrompt,
          schema: opts.schema,
          systemInstruction: fullSystem,
          temperature: t,
          maxOutputTokens: opts.maxOutputTokens,
          thinkingBudget: 0,
          retries: 1,
          model: "flash",
        })
      )
    );

    return results
      .filter(
        (r): r is PromiseFulfilledResult<Awaited<TCandidate>> =>
          r.status === "fulfilled"
      )
      .map((r) => r.value as TCandidate)
      .filter((c) => (opts.preFilter ? !opts.preFilter(c) : true));
  }

  // Pass 1: Generation ohne Avoid-Hint
  let candidates = await generatePass("");

  // Banned-Hits pro Kandidat ermitteln
  const hitsByIdx = (cs: TCandidate[]) =>
    cs.map((c) =>
      getBannedHitsForCandidate(
        c,
        opts.bannedCheckFields,
        opts.brandBannedPhrases ?? []
      )
    );

  let bannedHitsPerCandidate = hitsByIdx(candidates);
  let cleanCount = bannedHitsPerCandidate.filter((h) => h.length === 0).length;
  let passes = 1;

  // Wenn KEIN sauberer Kandidat: Retry-Pass mit explizitem Avoid-Hint
  if (cleanCount === 0 && candidates.length > 0) {
    const avoidHint = buildAvoidHint(opts.brandBannedPhrases ?? []);
    const observedFloskel = bannedHitsPerCandidate
      .flat()
      .map((h) => h.phrase)
      .slice(0, 8);
    const extra = observedFloskel.length
      ? `${avoidHint}\n\nDeine vorherigen Versuche hatten diese Probleme: ${observedFloskel.map((p) => `"${p}"`).join(", ")}. Schreibe es komplett anders.`
      : avoidHint;
    candidates = await generatePass(extra);
    bannedHitsPerCandidate = hitsByIdx(candidates);
    cleanCount = bannedHitsPerCandidate.filter((h) => h.length === 0).length;
    passes = 2;
  }

  // Wenn auch nach Retry keine Kandidaten: error
  if (candidates.length === 0) {
    throw new Error(
      `[${opts.debugTag ?? "text-pipeline"}] Generation failed: keine Kandidaten nach ${passes} Pass(es)`
    );
  }

  // Bei nur 1 Kandidat: skip Critique (Gemini-Call sparen)
  if (candidates.length === 1) {
    return {
      winner: candidates[0],
      cleanCount,
      passes,
      winnerBannedHits: bannedHitsPerCandidate[0] ?? [],
    };
  }

  // Self-Critique-Call. Wenn er fehlschlaegt, fallback auf "ersten sauberen
  // Kandidaten, sonst ersten ueberhaupt".
  let critic: CriticResponse | null = null;
  try {
    critic = await callGemini<CriticResponse>({
      prompt: buildCriticPrompt(candidates, opts),
      schema: CRITIC_SCHEMA,
      systemInstruction:
        "Du bist ein strenger Editor, der KI-Outputs gegen Brand-Voice-Standards prueft. Sei kritisch — generische, austauschbare Texte bekommen niedrige Scores. Sei besonders wachsam fuer 'sounds like AI'.",
      temperature: 0.2,
      maxOutputTokens: 2048,
      thinkingBudget: 256,
      retries: 1,
      model: "flash",
    });
  } catch (err) {
    console.warn(
      `[${opts.debugTag ?? "text-pipeline"}] Critic call failed, falling back to clean-first`,
      err
    );
  }

  // Winner-Auswahl: sauber > critic-score > erste
  const cleanIndices = bannedHitsPerCandidate
    .map((hits, idx) => ({ idx, clean: hits.length === 0 }))
    .filter((x) => x.clean)
    .map((x) => x.idx);

  let winnerIdx: number;
  if (critic) {
    // Critic-Score mit Banned-Penalty kombinieren
    const ranked = critic.scores
      .map((s) => {
        const banned = bannedHitsPerCandidate[s.candidateIndex]?.length ?? 0;
        const aiPenalty = s.soundsLikeAi ? 5 : 0;
        const bannedPenalty = banned * 2;
        return {
          idx: s.candidateIndex,
          finalScore: s.overallScore - aiPenalty - bannedPenalty,
        };
      })
      .filter((r) => r.idx >= 0 && r.idx < candidates.length)
      .sort((a, b) => b.finalScore - a.finalScore);
    winnerIdx = ranked[0]?.idx ?? cleanIndices[0] ?? 0;
  } else {
    winnerIdx = cleanIndices[0] ?? 0;
  }

  return {
    winner: candidates[winnerIdx],
    cleanCount,
    passes,
    winnerBannedHits: bannedHitsPerCandidate[winnerIdx] ?? [],
  };
}
