// User-Feedback 2026-05-19: Das Bienen-Icon wurde bei Biene KOMPLETT aus
// den PDFs entfernt (Cover, Foreword, Recipe-Footer, Outro) — es wirkte
// "billig". Die Komponente bleibt als no-op bestehen, damit die Call-Sites
// in pack-pdf.tsx + foreword-page.tsx + recipe-card-pdf.tsx nicht einzeln
// angefasst werden muessen. Sie rendert jetzt fuer ALLE Brands nichts mehr.
// Falls je ein Brand-Wappen zurueck soll: hier wieder bedingt rendern.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function BeeIcon(_props: { size?: number; brandSlug: string }) {
  return null;
}
