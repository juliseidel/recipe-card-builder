// iOS-style bee icon — rendered as inline SVG so it looks identical on
// every OS (Windows users were getting the flat system bee glyph, which
// felt off-brand). Same geometry as the PDF variant in lib/pdf/bee-icon.tsx
// so the booklet and the web view stay in lockstep.

type Props = {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Brand-Slug — historisch hat das Icon nur fuer Biene gerendert. Seit
   *  2026-05-19 (User-Feedback "wirkt billig") rendert die Komponente fuer
   *  ALLE Brands nichts mehr. Prop bleibt fuer Call-Site-Kompatibilitaet. */
  brandSlug: string;
};

// User-Feedback 2026-05-19: Das Bienen-Icon wurde bei Biene KOMPLETT
// entfernt (Web-Layouts, Footer, Signatur, Anfang + Ende) — es wirkte
// "billig". Die Komponente bleibt als no-op bestehen, damit die ~6
// Call-Sites in recipe-card-full.tsx nicht einzeln angefasst werden
// muessen. Sie rendert jetzt fuer ALLE Brands nichts mehr. Falls je ein
// Brand-Wappen zurueck soll: hier wieder bedingt rendern.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function BeeIcon(_props: Props) {
  return null;
}
