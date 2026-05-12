// Follower-Count-Formatter. Wird beim Onboarding genutzt (Apify liefert
// einen Integer), beim Hero-Render (gespeicherter String) und beim Re-
// Read fuer existing Brands. Output: "—" / "247" / "12.4K" / "1.2M".
//
// Wir akzeptieren sowohl number als auch string-Input — der gespeicherte
// brand.stats.followers ist ein String (manche Curated-Brands haben
// "819K" als Hand-eingestellten Wert), aber neue DB-Brands bekommen den
// numerischen Apify-Wert.

export function formatFollowersCompact(input: number | string | null | undefined): string {
  if (input === null || input === undefined) return "—";
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return "—";
    if (/[KMkm]/.test(trimmed)) {
      return trimmed.toUpperCase().replace(/(\d)([KM])/, "$1$2");
    }
    const n = parseInt(trimmed.replace(/[^\d]/g, ""), 10);
    return formatFollowersCompact(Number.isFinite(n) ? n : null);
  }
  if (!Number.isFinite(input) || input <= 0) return "—";
  if (input >= 1_000_000)
    return `${(input / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (input >= 1_000)
    return `${(input / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(input);
}
