import type { PackForewordContent } from "@/lib/ai/generate-foreword";

// Vorwort-Adapter. Bruecke zwischen v3-Block-Form (von gemini-2.5-pro
// generiert) und v2-Legacy-Form (greeting/story/signoff direkt als Strings).
//
// Warum existiert das:
//   - PDF-Renderer rendert seit v2 die Felder greeting/story/signoff
//   - Pack-Editor-UI bedient die gleichen 4 Felder als TextAreas
//   - generatePackForeword schreibt seit v3 stattdessen blocks: [...]
//
// Statt PDF-Renderer + Editor jeweils auf die neue Form umzuschreiben,
// adaptieren wir an einer Stelle: blocks → greeting + paragraphs.join("\n\n")
// + signoff. Damit bleibt das bestehende Layout-Verhalten intakt und neue
// Pro-generierte Forewords funktionieren sofort. Phase 2 koennte den
// Editor + Renderer auf echte Multi-Paragraph-UI umstellen.

export type ForewordLegacyFields = {
  greeting: string;
  story: string;
  signoff: string;
  outro: string;
};

/** Extrahiert die 4 klassischen Felder aus einem Foreword-Content, egal
 *  ob v3-Blocks oder v2-Flat. Bei blocks-Form werden Paragraph-Blocks
 *  mit `\n\n` zusammengefuegt — react-pdf rendert das als Leerzeile
 *  zwischen Absaetzen, was visuell als Absatz-Trennung lesbar ist.
 *
 *  Pullquote-Block (falls in v3 vorhanden) wird in Phase 1 IGNORIERT —
 *  Renderer hat noch keinen dedizierten Pullquote-Slot. Phase 2 wird das
 *  einbauen. Bis dahin geht der Inhalt nicht verloren (er steht in den
 *  blocks weiter), wird nur nicht gerendert. */
export function extractForewordLegacyFields(
  content: PackForewordContent | null | undefined
): ForewordLegacyFields {
  if (!content) {
    return { greeting: "", story: "", signoff: "", outro: "" };
  }

  // v3 mit blocks-Liste
  if (content.blocks && content.blocks.length > 0) {
    const greeting =
      content.blocks.find((b) => b.kind === "greeting")?.text ?? "";
    const paragraphs = content.blocks
      .filter((b) => b.kind === "paragraph")
      .map((b) => b.text.trim())
      .filter((t) => t.length > 0);
    const signoff =
      content.blocks.find((b) => b.kind === "signoff")?.text ?? "";
    return {
      greeting,
      story: paragraphs.join("\n\n"),
      signoff,
      outro: content.outro ?? "",
    };
  }

  // v2-Legacy
  return {
    greeting: content.greeting ?? "",
    story: content.story ?? "",
    signoff: content.signoff ?? "",
    outro: content.outro ?? "",
  };
}

// ─── Reiche Extraktion fuer Multi-Paragraph- + Pull-Quote-Layouts ──────────
// Wie extractForewordLegacyFields, aber erhaelt die Absatz-STRUKTUR als Array
// UND den Pullquote. Fuer Renderer, die echte mehr-spaltige Absaetze und eine
// eigene Pull-Quote setzen koennen — konkret die Premium-Buch-Vorwort-Seite
// (lib/pdf/pack-pdf.tsx → PremiumForewordPage). Der Legacy-Extractor oben
// bleibt fuer alle bestehenden Layouts, die nur ein flaches story-Feld lesen.
export type ForewordParts = {
  greeting: string;
  paragraphs: string[];
  pullquote: string;
  signoff: string;
  outro: string;
};

export function extractForewordParts(
  content: PackForewordContent | null | undefined
): ForewordParts {
  if (!content) {
    return { greeting: "", paragraphs: [], pullquote: "", signoff: "", outro: "" };
  }

  // v3 mit blocks-Liste — Paragraph-Blocks bleiben getrennt, Pullquote-Block
  // wird (anders als im Legacy-Extractor) erhalten.
  if (content.blocks && content.blocks.length > 0) {
    const greeting =
      content.blocks.find((b) => b.kind === "greeting")?.text ?? "";
    const paragraphs = content.blocks
      .filter((b) => b.kind === "paragraph")
      .map((b) => b.text.trim())
      .filter((t) => t.length > 0);
    const pullquote =
      content.blocks.find((b) => b.kind === "pullquote")?.text?.trim() ?? "";
    const signoff =
      content.blocks.find((b) => b.kind === "signoff")?.text ?? "";
    return { greeting, paragraphs, pullquote, signoff, outro: content.outro ?? "" };
  }

  // v2-Legacy: story an Doppel-Umbruechen in Absaetze splitten; Pullquote
  // gab es in v2 nicht.
  const paragraphs = (content.story ?? "")
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return {
    greeting: content.greeting ?? "",
    paragraphs,
    pullquote: "",
    signoff: content.signoff ?? "",
    outro: content.outro ?? "",
  };
}
