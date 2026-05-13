import type { Pack } from "@/lib/packs";
import { resolveSurface } from "@/lib/packs";
import { surfaceToPdfColor } from "@/lib/pack-surface";

// A4 in PDF points (1pt = 1/72 in). Render-time DPI is irrelevant for vector
// content — text & shapes scale lossless. Embedded JPEGs at 1000–2000 px give
// >180 DPI at A4 page width, which is print-acceptable.
export const A4 = { width: 595, height: 842 } as const;
export const PAGE_PADDING = 36;

export type CardTheme = {
  bg: string;
  surface: string;
  ink: string;
  inkSoft: string;
  inkSubtle: string;
  accent: string;
  accentSoft: string;
  paper: string;
  divider: string;
};

export function packTheme(pack: Pack): CardTheme {
  // PDF respektiert den neuen surface-Type, faellt aber auf solid color
  // zurueck. Gradient/Pattern werden vom PDF-Renderer als single color
  // approximated (siehe surfaceToPdfColor) — die Live-Web-Cover zeigt das
  // volle Pattern.
  const surface = resolveSurface(pack.mood);
  const flatBg = surfaceToPdfColor(surface);
  return {
    bg: flatBg,
    surface: "#ffffff",
    ink: pack.mood.ink,
    inkSoft: pack.mood.inkSoft,
    inkSubtle: withAlpha(pack.mood.inkSoft, 0.6),
    accent: pack.mood.accent,
    accentSoft: withAlpha(pack.mood.accent, 0.18),
    paper: blendWithWhite(flatBg, 0.78),
    divider: withAlpha(pack.mood.ink, 0.12),
  };
}

export function fontFamilyForPack(pack: Pack): "Fraunces" | "Inter" {
  return pack.displayFont === "inter-tight" ? "Inter" : "Fraunces";
}

// Mix any HEX color toward white — softer page backgrounds.
export function blendWithWhite(hex: string, whiteRatio: number): string {
  const { r, g, b } = parseHex(hex);
  const blend = (c: number) =>
    Math.round(c + (255 - c) * Math.max(0, Math.min(1, whiteRatio)));
  return rgbToHex(blend(r), blend(g), blend(b));
}

// @react-pdf/renderer's PDF backend renders 8-digit hex AND rgba() with
// out-of-range stroke values (RGB > 1.0) which clamp to red on print —
// hence the rogue "coral" lines we kept seeing. The reliable workaround is
// to pre-mix toward white and emit a flat 6-digit hex. For overlays on
// non-white backgrounds, use the `opacity` style prop on the View instead.
export function withAlpha(hex: string, alpha: number): string {
  return blendWithWhite(hex, 1 - alpha);
}

function parseHex(input: string): { r: number; g: number; b: number } {
  const hex = input.replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}
