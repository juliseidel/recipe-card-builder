import type {
  PackSurface,
  GradientSurface,
  PatternSurface,
  PatternId,
} from "./packs";

// Surface-Renderer fuer Pack-Hintergruende. Drei Typen:
//   solid    → einfache Farbe (alter Default)
//   gradient → linear/radial mit 2-3 Stops
//   pattern  → procedural SVG-Pattern ueber base color
//
// Web nutzt CSS background-Strings. PDF nutzt vereinfachte Strategie:
//   solid    → flat color (react-pdf nativ)
//   gradient → react-pdf v4 hat KEINE Gradient-Stuetze in style;
//              wir liefern eine Approximation (mittlere Stop-Farbe als solid).
//              Fuer richtigen Gradient: pre-rendered PNG noetig (Phase C).
//   pattern  → react-pdf rendert SVG-Pattern via data-URI background image
//              moeglich, aber experimentell. Wir liefern fuer PDF die
//              base color als solid. Pattern bleibt Web-only fuer jetzt.
//
// Diese Tradeoff ist bewusst: Live-Pack-Cover sieht im Browser premium aus
// (Patterns sichtbar), der CMYK-Druck-PDF bleibt clean-flat (besser fuer
// Print-Reproduzierbarkeit als unkalibrierte Patterns).

// ─── Web (CSS) ────────────────────────────────────────────────────────────

/**
 * Gibt einen CSS-`background`-String zurueck. Funktioniert in
 * style={{ background: ... }} und ueberlagert eine Solid color in einem
 * <div>. Patterns nutzen `url("data:image/svg+xml,...")` damit kein
 * extra HTTP-Request noetig ist.
 */
export function surfaceToCss(surface: PackSurface): string {
  if (surface.type === "solid") {
    return surface.color;
  }
  if (surface.type === "gradient") {
    return gradientToCss(surface);
  }
  return patternToCss(surface);
}

function gradientToCss(g: GradientSurface): string {
  const stops = g.stops
    .map((s) => `${s.color} ${Math.round(s.position * 100)}%`)
    .join(", ");
  if (g.variant === "radial") {
    return `radial-gradient(circle at center, ${stops})`;
  }
  const angle = typeof g.angle === "number" ? g.angle : 135;
  return `linear-gradient(${angle}deg, ${stops})`;
}

function patternToCss(p: PatternSurface): string {
  const scale = p.scale ?? 1;
  const opacity = p.opacity ?? 1;
  const svg = buildPatternSvg(p.patternId, p.baseColor, p.accentColor, scale, opacity);
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, "%27")
    .replace(/"/g, "%22");
  // Zwei Layer: SVG-Pattern oben, base color unten als Fallback.
  return `url("data:image/svg+xml;utf8,${encoded}") ${p.baseColor}`;
}

// ─── Pattern-SVG-Bauer ────────────────────────────────────────────────────
//
// Jedes Pattern returnt ein vollstaendiges SVG mit <pattern>-Definition
// das als CSS-bg-image referenziert wird. Die Tile-Size wird durch
// `scale` skaliert.

function buildPatternSvg(
  id: PatternId,
  baseColor: string,
  accentColor: string,
  scale: number,
  opacity: number
): string {
  const baseTile = 40;
  const tile = Math.max(16, Math.min(120, Math.round(baseTile * scale)));
  const accent = `${accentColor}${opacityToHex(opacity)}`;

  switch (id) {
    case "polka":
      // Klassische Punkt-Wolke
      return wrap(
        tile,
        `<circle cx='${tile / 2}' cy='${tile / 2}' r='${tile * 0.12}' fill='${accent}' />`
      );
    case "honeycomb": {
      // Sechseck-Grid (passt zu Biene)
      const w = tile;
      const h = Math.round(tile * 1.155);
      const r = w * 0.45;
      const points = (cx: number, cy: number) =>
        [0, 60, 120, 180, 240, 300]
          .map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return `${cx + r * Math.cos(rad)},${cy + r * Math.sin(rad)}`;
          })
          .join(" ");
      const body = `
        <polygon points='${points(w / 2, h / 2)}' fill='none' stroke='${accent}' stroke-width='1.2' />
        <polygon points='${points(0, 0)}' fill='none' stroke='${accent}' stroke-width='1.2' />
        <polygon points='${points(w, 0)}' fill='none' stroke='${accent}' stroke-width='1.2' />
        <polygon points='${points(0, h)}' fill='none' stroke='${accent}' stroke-width='1.2' />
        <polygon points='${points(w, h)}' fill='none' stroke='${accent}' stroke-width='1.2' />
      `;
      return wrap(w, body, h);
    }
    case "crosshatch":
      // Diagonale Cross-Hatching wie Editorial-Print
      return wrap(
        tile,
        `<path d='M-2,${tile + 2}L${tile + 2},-2 M${tile / 2 - 2},${tile + 2}L${tile + 2},${tile / 2 - 2}' stroke='${accent}' stroke-width='0.8' />
         <path d='M-2,-2L${tile + 2},${tile + 2} M${tile / 2 - 2},-2L${tile + 2},${tile / 2 + 2}' stroke='${accent}' stroke-width='0.8' />`
      );
    case "topo": {
      // Hoehenlinien-Look
      const r1 = tile * 0.38;
      const r2 = tile * 0.26;
      const r3 = tile * 0.14;
      return wrap(
        tile,
        `<circle cx='${tile / 2}' cy='${tile / 2}' r='${r1}' fill='none' stroke='${accent}' stroke-width='0.7' />
         <circle cx='${tile / 2}' cy='${tile / 2}' r='${r2}' fill='none' stroke='${accent}' stroke-width='0.7' />
         <circle cx='${tile / 2}' cy='${tile / 2}' r='${r3}' fill='none' stroke='${accent}' stroke-width='0.7' />`
      );
    }
    case "marble": {
      // Organische Linien — vorgekochte Pfade fuer reproducible look
      const w = tile * 2;
      const h = tile * 2;
      return wrap(
        w,
        `<path d='M0,${h * 0.25} Q${w * 0.25},${h * 0.05} ${w * 0.5},${h * 0.35} T${w},${h * 0.2}' fill='none' stroke='${accent}' stroke-width='0.9' />
         <path d='M0,${h * 0.65} Q${w * 0.3},${h * 0.55} ${w * 0.5},${h * 0.7} T${w},${h * 0.6}' fill='none' stroke='${accent}' stroke-width='0.9' />
         <path d='M0,${h * 0.9} Q${w * 0.25},${h * 0.8} ${w * 0.5},${h * 0.95} T${w},${h * 0.85}' fill='none' stroke='${accent}' stroke-width='0.9' />`,
        h
      );
    }
    case "stripes":
      // Diagonale Streifen
      return wrap(
        tile,
        `<path d='M-2,-2L${tile + 2},${tile + 2}' stroke='${accent}' stroke-width='${tile * 0.18}' />`
      );
    case "grid":
      // Bento-Linien-Grid
      return wrap(
        tile,
        `<path d='M0,0H${tile}M0,${tile / 2}H${tile}M0,${tile - 1}H${tile}M0,0V${tile}M${tile / 2},0V${tile}M${tile - 1},0V${tile}' stroke='${accent}' stroke-width='0.6' fill='none' />`
      );
    case "confetti": {
      // Zufaellig verteilte kurze Striche
      const lines = [
        [0.15, 0.2, 0.25, 0.32, 32],
        [0.45, 0.15, 0.55, 0.22, -18],
        [0.7, 0.4, 0.78, 0.5, 45],
        [0.2, 0.6, 0.3, 0.68, -32],
        [0.55, 0.7, 0.62, 0.82, 20],
        [0.82, 0.78, 0.95, 0.88, -45],
      ];
      const body = lines
        .map(
          ([x1, y1, x2, y2]) =>
            `<line x1='${x1 * tile}' y1='${y1 * tile}' x2='${x2 * tile}' y2='${y2 * tile}' stroke='${accent}' stroke-width='1.4' stroke-linecap='round' />`
        )
        .join("");
      return wrap(tile, body);
    }
    default:
      return wrap(tile, "");
  }
}

function wrap(width: number, body: string, height?: number): string {
  const h = height ?? width;
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${h}' viewBox='0 0 ${width} ${h}'>${body}</svg>`;
}

function opacityToHex(opacity: number): string {
  const clamped = Math.max(0, Math.min(1, opacity));
  if (clamped >= 0.999) return "";
  const value = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, "0");
  return value;
}

// ─── PDF (react-pdf) ──────────────────────────────────────────────────────
//
// react-pdf v4 unterstuetzt NUR solid colors in `style.backgroundColor`
// und einfache Linear-Gradients via Linear-Gradient-Stops in Svg-Defs.
// Fuer flache Hintergruende reicht das aber — wir liefern fuer Gradient
// eine pragmatische Approximation (Mittelwert der Stop-Colors), fuer
// Pattern die base color. Print-Pipeline ist damit konsistent.

/**
 * Gibt eine flache color fuer react-pdf-Renders zurueck. Gradient wird
 * auf den mittleren Stop reduziert, Pattern auf base color.
 */
export function surfaceToPdfColor(surface: PackSurface): string {
  if (surface.type === "solid") return surface.color;
  if (surface.type === "gradient") {
    // Pick mittleren Stop oder ersten falls 2 Stops
    const mid = Math.floor(surface.stops.length / 2);
    return surface.stops[mid]?.color ?? surface.stops[0].color;
  }
  return surface.baseColor;
}

// ─── Pattern-Katalog (fuer UI-Picker) ─────────────────────────────────────

export const PATTERN_CATALOG: { id: PatternId; label: string; description: string }[] = [
  { id: "polka", label: "Polka", description: "Klassische Punkt-Wolke" },
  { id: "honeycomb", label: "Honeycomb", description: "Sechseck-Grid (Biene-Wappen)" },
  { id: "crosshatch", label: "Cross-Hatch", description: "Editorial-Print-Look" },
  { id: "topo", label: "Topographie", description: "Höhenlinien-Look" },
  { id: "marble", label: "Marmor", description: "Organische Linien-Bänder" },
  { id: "stripes", label: "Stripes", description: "Diagonale Streifen, kräftig" },
  { id: "grid", label: "Bento Grid", description: "Linien-Grid, Notion-Vibe" },
  { id: "confetti", label: "Confetti", description: "Verstreute Akzent-Striche" },
];

export const GRADIENT_PRESETS = [
  { id: "sunset", label: "Sunset", stops: ["#f4d88d", "#e8889b"] },
  { id: "ocean", label: "Ocean", stops: ["#b4cde4", "#3f7560"] },
  { id: "forest", label: "Forest", stops: ["#c8e2a8", "#3f7560"] },
  { id: "berry", label: "Berry", stops: ["#f3cdd3", "#735090"] },
  { id: "honey", label: "Honey", stops: ["#f4d88d", "#b07a2a"] },
  { id: "rose-gold", label: "Rose Gold", stops: ["#f7d4b8", "#a94d61"] },
];
