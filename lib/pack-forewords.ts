// Cached pack-forewords. Mirrors the pattern of lib/recipe-micros.ts —
// a static map keyed by pack slug, populated by a generation script and
// committed to git. The render pipeline reads from this cache instead
// of calling Gemini at render-time, so PDFs render in a few hundred
// milliseconds rather than tens of seconds.
//
// Re-generieren: `npx tsx scripts/generate-foreword-assets.ts <packSlug>`
// (single pack) oder `npx tsx scripts/generate-foreword-assets.ts --all`
// (alle Packs neu). Die Re-generation ist nicht-destruktiv: bestehende
// Einträge werden ueberschrieben (mit --force), andere bleiben unangetastet.
//
// Auto-generated content — manual edits are okay und werden erst beim
// nächsten --force-Lauf des Skripts ueberschrieben.

import type { PackForewordContent } from "./ai/generate-foreword";

export const packForewords: Record<string, PackForewordContent> = {
  "bienes-backwelt": {
    greeting: "Hi, ich bin Biene.",
    story:
      "Backen ist meine Paradedisziplin. Hier sind 10 meiner liebsten Werke aus den Reels — Schoko-Biskuitrolle, Cheesecake, Erdbeer-Kuppeltorte. Alle ohne zugesetzten Zucker, alle WPF-tauglich, alle so, wie ich sie selbst in meiner Küche backe, wenn ich Lust auf etwas Süßes habe.",
    signoff: "Schnapp dir einen Kaffee und blätter durch.",
  },
};

export function getPackForeword(packSlug: string): PackForewordContent | null {
  return packForewords[packSlug] ?? null;
}
