import type { Pack } from "@/lib/packs";

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
  return {
    bg: pack.mood.background,
    surface: "#ffffff",
    ink: pack.mood.ink,
    inkSoft: pack.mood.inkSoft,
    inkSubtle: withAlpha(pack.mood.inkSoft, 0.6),
    accent: pack.mood.accent,
    accentSoft: withAlpha(pack.mood.accent, 0.18),
    paper: blendWithWhite(pack.mood.background, 0.78),
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

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
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
