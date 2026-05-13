import Image from "next/image";
import { BeeIcon } from "./bee-icon";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import {
  normalizeStep,
  nutritionBasisLabel,
  nutritionBasisLabelShort,
  nutritionBasisInline,
  type Recipe,
} from "@/lib/recipes";
import {
  HeroSkeleton,
  MicrosSkeletonBanner,
  MicrosSkeletonStrip,
} from "./enrichment-skeletons";

// While a custom recipe waits for Gemini micros + Flux hero we want the
// card itself to make the gap visible — otherwise the pack-cover fallback
// looks like a finished card with weirdly missing micros. `EnrichingState`
// tracks each piece so we can swap in a skeleton per slot independently.
export type EnrichingState = {
  hero: boolean;
  micros: boolean;
};

// Web mirror of lib/pdf/helpers.ts#groupSteps — groups recipe steps by
// their optional `group` field so layouts can render "Für den Teig" /
// "Glasur" sections with continuous global numbering.
type WebStepGroup = {
  name: string | null;
  items: Array<{ text: string; index: number }>;
};
function groupRecipeSteps(steps: Recipe["steps"]): WebStepGroup[] {
  const main: WebStepGroup = { name: null, items: [] };
  const groups = new Map<string, WebStepGroup>();
  steps.forEach((raw, idx) => {
    const s = normalizeStep(raw);
    const item = { text: s.text, index: idx };
    if (s.group) {
      if (!groups.has(s.group))
        groups.set(s.group, { name: s.group, items: [] });
      groups.get(s.group)!.items.push(item);
    } else {
      main.items.push(item);
    }
  });
  const out: WebStepGroup[] = [];
  if (main.items.length > 0) out.push(main);
  groups.forEach((g) => out.push(g));
  return out;
}

type RecipeCardFullProps = {
  brand: Brand;
  pack: Pack;
  recipe: Recipe;
  totalRecipes: number;
  enriching?: EnrichingState;
};

// Sparse-Detection für den "Bienes Story"-Pull-Quote-Block. Spiegel der
// PDF-Helfer in lib/pdf/recipe-card-pdf.tsx#shouldShowStory: ein Rezept
// gilt als kurz genug, dass die Karte ohne zusätzlichen Erzähl-Block
// halbleer wirken würde, wenn es ≤10 Zutaten hat. Editorial ist davon
// ausgenommen — dort ist die Story strukturelles Element und wird immer
// gezeigt, wenn `recipe.description` vorhanden ist.
//
// Der Block ist gedacht für: 3-Zutaten-Eisbowl, Kaiserschmarrn, Marzipan-
// Kugeln, schnelle Snacks, kurze Hauptgerichte. Lange Volumen-Bowls
// (16 Zutaten) lassen ihn weg — die füllen die Karte aus eigener Kraft.
export function webShouldShowStory(recipe: Recipe): boolean {
  return (
    recipe.ingredients.length <= 10 &&
    Boolean(recipe.description?.trim())
  );
}

// Reusable Story-Pull-Quote-Block. Pack-Mood-eingefärbt, italic Fraunces.
// Kommt visuell in jedem Layout an leicht anderer Stelle (siehe Caller),
// aber das Innenleben bleibt identisch — kein per-Layout-Drift mehr.
//
// Caller-Verantwortung: rufe webShouldShowStory(recipe) als Wrapper-
// Bedingung auf. Diese Komponente prüft nur noch defensiv ob description
// überhaupt etwas enthält (für den seltenen Race wo description erst nach
// Hydration generiert wird).
export function WebStoryBlock({
  recipe,
  pack,
  className,
}: {
  recipe: Recipe;
  pack: Pack;
  /** Optional Override für äußere Spacings/Borders pro Layout. Default
   *  ist border-b + padded für Inline-Use zwischen Header und Body. */
  className?: string;
}) {
  if (!recipe.description?.trim()) return null;
  return (
    <div
      className={
        className ??
        "border-b px-8 py-6 sm:px-12"
      }
      style={{
        borderColor: pack.mood.ink + "1a",
        background: pack.mood.background + "20",
      }}
    >
      <div
        className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em]"
        style={{ color: pack.mood.accent }}
      >
        Story
      </div>
      <p
        className="max-w-[60ch] font-display text-[17px] italic leading-relaxed"
        style={{ color: pack.mood.ink }}
      >
        {recipe.description}
      </p>
    </div>
  );
}

export function RecipeCardFull(props: RecipeCardFullProps) {
  // Per-recipe layout override wins over pack.cardLayout. Lets users pick
  // a layout per card in the editor independent of the pack default.
  const layout = props.recipe.cardLayout ?? props.pack.cardLayout;
  switch (layout) {
    case "editorial":
      return <EditorialLayout {...props} />;
    case "patisserie":
      return <PatisserieLayout {...props} />;
    case "minimal":
      return <MinimalLayout {...props} />;
    case "sport":
      return <SportLayout {...props} />;
    case "dashboard":
      return <DashboardLayout {...props} />;
    case "vital":
      return <VitalLayout {...props} />;
    case "amber":
      return <AmberLayout {...props} />;
    case "vinyl":
      return <VinylLayout {...props} />;
  }
}

const baseShellStyle = (pack: Pack, brand: Brand): React.CSSProperties => ({
  borderColor: brand.tokens.line,
  boxShadow:
    "0 1px 0 rgba(43,31,25,0.05), 0 28px 60px -28px rgba(43,31,25,0.25)",
});

// ════════════════════════════════════════════════
// HELPER: Detect ingredient subgroups (e.g. "für die Mayo", "Teig", "Topping")
// ════════════════════════════════════════════════
type IngredientGroup = {
  name: string | null;
  items: Array<{ amount: string; name: string; note?: string }>;
};

function detectIngredientGroup(
  note?: string
): { group: string | null; remainingNote?: string } {
  if (!note) return { group: null };
  // Pattern 1: "für die X" / "für den X" / "für das X"
  const fuerMatch = note.match(
    /^für (?:die|den|das)\s+(.+?)(?:\s·\s*(.*))?$/i
  );
  if (fuerMatch) {
    return {
      group: fuerMatch[1].trim(),
      remainingNote: fuerMatch[2]?.trim() || undefined,
    };
  }
  // Pattern 2: Direct keyword
  const keywordMatch = note.match(
    /^(Teig|Topping|Sauce|Belag|Glasur|Streusel|Füllung|Boden|Creme|Krem)(?:\s·\s*(.*))?$/i
  );
  if (keywordMatch) {
    return {
      group: keywordMatch[1],
      remainingNote: keywordMatch[2]?.trim() || undefined,
    };
  }
  return { group: null };
}

function groupIngredients(
  ingredients: Recipe["ingredients"]
): IngredientGroup[] {
  const mainGroup: IngredientGroup = { name: null, items: [] };
  const groupMap = new Map<string, IngredientGroup>();

  ingredients.forEach((ing) => {
    // Editor-produced ingredients carry the group name explicitly; the
    // curated 37 recipes encode it as a "für die X" / keyword note. We
    // try the explicit field first, then fall back to note-based detection.
    let groupName: string | null = ing.group?.trim() || null;
    let cleanedNote: string | undefined = ing.note;
    if (!groupName) {
      const detected = detectIngredientGroup(ing.note);
      groupName = detected.group;
      cleanedNote = detected.remainingNote;
    }
    const item = { amount: ing.amount, name: ing.name, note: cleanedNote };
    if (groupName) {
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, { name: groupName, items: [] });
      }
      groupMap.get(groupName)!.items.push(item);
    } else {
      mainGroup.items.push(item);
    }
  });

  const result: IngredientGroup[] = [];
  if (mainGroup.items.length > 0) result.push(mainGroup);
  groupMap.forEach((g) => result.push(g));
  return result;
}

// ════════════════════════════════════════════════
// LAYOUT 1: EDITORIAL (Magazine-Stage) — Pack 5 (Feierabend-Klassiker, Honey)
//
// Bienes WPF-Hauptgerichte get the magazine-cover treatment: full-width
// 3:2 hero photo at the top (no side-by-side title — Pack 1 Patisserie and
// Pack 2 Sport already use that), title-band below the photo, and the
// signature move — Mikronährstoffe aren't tucked into the footer like
// every other pack but rendered as a prominent "Nutrient Banner" right
// after the title, animated progress dots fill in on mount. Stats bar +
// pull-quote sit below, body 2-col closes it out.
// ════════════════════════════════════════════════
function EditorialLayout({
  brand,
  pack,
  recipe,
  totalRecipes,
  enriching,
}: RecipeCardFullProps) {
  const totalTime = recipe.prepTime + (recipe.cookTime ?? 0);
  const grouped = groupIngredients(recipe.ingredients);
  const portionsLabel = recipe.servings === 1 ? "Portion" : "Portionen";

  return (
    <article
      className="mx-auto w-full max-w-[960px] overflow-hidden rounded-[var(--radius-card)] border bg-white"
      style={baseShellStyle(pack, brand)}
    >
      {/* TOP MARKER BAR — slim pack tagline strip; pack-title sits in the
          page breadcrumb already, so this row only carries pack-mood. */}
      <header
        className="flex items-center justify-between gap-3 border-b px-8 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] sm:px-12"
        style={{
          borderColor: pack.mood.ink + "1a",
          background: pack.mood.background + "40",
        }}
      >
        <span style={{ color: pack.mood.inkSoft }}>{pack.title}</span>
        {pack.tagline ? (
          <span
            className="hidden font-mono italic normal-case sm:inline"
            style={{ color: pack.mood.inkSoft, opacity: 0.7, letterSpacing: 0 }}
          >
            {pack.tagline}
          </span>
        ) : null}
      </header>

      {/* TITLE SECTION — photo LEFT, title content RIGHT. The other side-
          by-side packs (Patisserie, Sport) all put the photo right; Pack 5
          mirrors that to a left-aligned hero so the visual weight reads
          differently while staying compact (no full-bleed photo so source
          quality always looks tight). */}
      <div
        className="grid grid-cols-1 gap-8 px-8 pt-10 pb-10 sm:px-12 sm:pt-12 lg:grid-cols-[1fr_1.3fr] lg:gap-12"
        style={{ background: pack.mood.background + "20" }}
      >
        <div className="relative">
          <div
            className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-2xl lg:mr-auto"
            style={{
              boxShadow:
                "0 1px 0 rgba(43,31,25,0.05), 0 28px 50px -22px rgba(43,31,25,0.28)",
            }}
          >
            {enriching?.hero ? (
              <HeroSkeleton pack={pack} />
            ) : (
              <Image
                src={recipe.hero ?? pack.coverImage}
                alt={recipe.title}
                fill
                sizes="(min-width: 1024px) 320px, 100vw"
                className="object-cover content-fade-in"
                priority
                quality={95}
/>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-5">
          <div className="flex flex-col gap-3">
            <h1
              className="font-display text-[40px] uppercase leading-[0.96] tracking-[-0.01em] sm:text-[52px]"
              style={{ color: pack.mood.ink }}
            >
              {recipe.title}
            </h1>
            <p
              className="font-display text-[18px] italic leading-snug"
              style={{ color: pack.mood.inkSoft }}
            >
              {recipe.subtitle}
            </p>
            <div
              className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]"
              style={{ color: pack.mood.inkSoft }}
            >
              <span>{totalTime} Minuten</span>
              <span>·</span>
              <span>
                ergibt {recipe.servings} {portionsLabel}
              </span>
              <span>·</span>
              <span>{recipe.difficulty}</span>
            </div>
          </div>
          {recipe.tags?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {recipe.tags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]"
                  style={{
                    background: pack.mood.background,
                    color: pack.mood.ink,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* NUTRIENT BANNER — pack-5 signature move: Mikros are surfaced HERE,
          right after the title, instead of in the footer like every other
          pack. Bars animate in via CSS keyframe on mount. */}
      {enriching?.micros ? (
        <MicrosSkeletonBanner pack={pack} />
      ) : (
        <EditorialNutrientBanner recipe={recipe} pack={pack} />
      )}

      {/* 4-TILE STATS BAR */}
      <div
        className="grid grid-cols-2 border-b sm:grid-cols-4"
        style={{ borderColor: pack.mood.ink + "1f" }}
      >
        <EditorialStatTile
          label="Rezept ergibt"
          value={`${recipe.servings}×`}
          sub={portionsLabel}
          pack={pack}
        />
        <EditorialStatTile
          label={nutritionBasisLabelShort(recipe.nutritionBasis)}
          value={String(recipe.nutrition.kcal)}
          sub={`kcal · ${recipe.nutrition.carbs}g KH · ${recipe.nutrition.fat}g Fett`}
          pack={pack}
          highlight
        />
        <EditorialStatTile
          label="Eiweiß"
          value={`${recipe.nutrition.protein}g`}
          sub={nutritionBasisInline(recipe.nutritionBasis)}
          pack={pack}
        />
        <EditorialStatTile
          label="Gesamtzeit"
          value={String(totalTime)}
          sub={`Min · ${recipe.difficulty}`}
          pack={pack}
        />
      </div>

      {/* BIENES STORY — pull-quote with «»-quotes, honey-tinted */}
      {recipe.description ? (
        <div
          className="border-b px-8 py-7 sm:px-12 sm:py-8"
          style={{
            borderColor: pack.mood.ink + "1f",
            background: pack.mood.background + "30",
          }}
        >
          <div
            className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: pack.mood.accent }}
          >
            Story
          </div>
          <p
            className="font-display text-[19px] italic leading-relaxed"
            style={{ color: pack.mood.ink }}
          >
            «&nbsp;{recipe.description}&nbsp;»
          </p>
        </div>
      ) : null}

      {/* BODY: Ingredients (group-aware) + Steps */}
      <div className="grid grid-cols-1 gap-10 px-8 py-10 sm:px-12 lg:grid-cols-[0.95fr_1.1fr] lg:gap-14">
        <section>
          <div
            className="flex items-baseline justify-between gap-3 border-b pb-3"
            style={{ borderColor: pack.mood.ink + "20" }}
          >
            <h2
              className="text-[12px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: pack.mood.accent }}
            >
              Man nehme
            </h2>
            <span
              className="text-[10px] font-medium uppercase tracking-[0.14em]"
              style={{ color: pack.mood.inkSoft }}
            >
              für {recipe.servings} {portionsLabel}
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-6">
            {grouped.map((group, gIdx) => {
              const useTwoCol = !group.name && group.items.length > 8;
              return (
                <div key={group.name ?? `main-${gIdx}`}>
                  {group.name ? (
                    <h3
                      className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em]"
                      style={{ color: pack.mood.inkSoft }}
                    >
                      Für {group.name.toLowerCase()}
                    </h3>
                  ) : null}
                  <ul
                    className={
                      useTwoCol
                        ? "grid grid-cols-1 gap-x-6 sm:grid-cols-2"
                        : "flex flex-col"
                    }
                  >
                    {group.items.map((ing, iIdx) => (
                      <li
                        key={`${ing.name}-${iIdx}`}
                        className="grid grid-cols-[4.5rem_1fr] items-start gap-3 border-b py-2"
                        style={{
                          borderColor: pack.mood.ink + "10",
                          color: pack.mood.ink,
                        }}
                      >
                        <span
                          className="font-mono text-[12px] tabular-nums break-words"
                          style={{ color: pack.mood.inkSoft }}
                        >
                          {ing.amount}
                        </span>
                        <span className="text-[14px] leading-snug">
                          {ing.name}
                          {ing.note ? (
                            <span
                              className="block text-[11px] italic"
                              style={{ color: pack.mood.inkSoft }}
                            >
                              {ing.note}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <div
            className="flex items-baseline justify-between gap-3 border-b pb-3"
            style={{ borderColor: pack.mood.ink + "20" }}
          >
            <h2
              className="text-[12px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: pack.mood.accent }}
            >
              Zubereitung
            </h2>
            <span
              className="text-[10px] font-medium uppercase tracking-[0.14em]"
              style={{ color: pack.mood.inkSoft }}
            >
              {recipe.steps.length} Schritte
            </span>
          </div>
          <ol className="mt-5 flex flex-col gap-5">
            {groupRecipeSteps(recipe.steps).map((group, gIdx) => (
              <li key={`sg-${gIdx}`} className="contents">
                {group.name ? (
                  <li
                    className="text-[11px] font-semibold uppercase tracking-[0.22em]"
                    style={{
                      color: pack.mood.accent,
                      marginTop: gIdx > 0 ? "0.5rem" : 0,
                    }}
                  >
                    {group.name}
                  </li>
                ) : null}
                {group.items.map((item) => (
                  <li
                    key={item.index}
                    className="grid grid-cols-[2.4rem_1fr] gap-3"
                  >
                    <span
                      className="font-display text-[28px] leading-none tabular-nums"
                      style={{ color: pack.mood.accent }}
                    >
                      {item.index + 1}
                    </span>
                    <span
                      className="text-[15px] leading-[1.55]"
                      style={{ color: pack.mood.ink }}
                    >
                      {item.text}
                    </span>
                  </li>
                ))}
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* No micros strip in footer — they live up top in the Nutrient
          Banner instead. Pack 5's signature: Mikros are a hero element,
          not an afterthought. */}
      <CardFooter brand={brand} pack={pack} recipe={recipe} hideMicros />
    </article>
  );
}

// ─── Pack-5 Nutrient Banner — Mikros at the top, animated bars on mount ──
function EditorialNutrientBanner({
  recipe,
  pack,
}: {
  recipe: Recipe;
  pack: Pack;
}) {
  const micros = recipe.nutrition.micros;
  if (!micros || micros.length === 0) return null;
  // Top 6 micros so the banner stays one tidy row of three columns × 2 rows
  const top = [...micros]
    .sort((a, b) => (b.pctDaily ?? 0) - (a.pctDaily ?? 0))
    .slice(0, 6);

  return (
    <div
      className="border-b px-8 py-6 sm:px-12 sm:py-7"
      style={{
        borderColor: pack.mood.ink + "1f",
        background: pack.mood.background + "55",
      }}
    >
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3
          className="text-[12px] font-semibold uppercase tracking-[0.22em]"
          style={{ color: pack.mood.accent }}
        >
          Reich an
        </h3>
        <span
          className="text-[10px] font-medium uppercase tracking-[0.14em]"
          style={{ color: pack.mood.inkSoft }}
        >
          Mikronährstoffe {nutritionBasisInline(recipe.nutritionBasis)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {top.map((m, idx) => {
          const pct = Math.min(100, m.pctDaily ?? 0);
          // Stagger animation by index for a cascading fill effect
          return (
            <div key={m.name} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className="text-[12px] font-medium"
                  style={{ color: pack.mood.ink }}
                >
                  {m.name}
                </span>
                <span
                  className="font-mono text-[10px] tabular-nums"
                  style={{ color: pack.mood.inkSoft }}
                >
                  {m.amount}
                </span>
              </div>
              <div
                className="relative h-1.5 overflow-hidden rounded-full"
                style={{ background: pack.mood.ink + "12" }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full editorial-bar-fill"
                  style={
                    {
                      "--bar-target": `${pct}%`,
                      animationDelay: `${idx * 80}ms`,
                      background: pack.mood.accent,
                    } as React.CSSProperties
                  }
                />
              </div>
              <span
                className="self-end font-mono text-[10px] font-bold tabular-nums"
                style={{ color: pack.mood.accent }}
              >
                {pct}% Tagesbedarf
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EditorialStatTile({
  label,
  value,
  sub,
  pack,
  highlight = false,
}: {
  label: string;
  value: string;
  sub?: string;
  pack: Pack;
  highlight?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center gap-1 border-r px-3 py-6 text-center last:border-r-0 [&:nth-child(2)]:border-b sm:[&:nth-child(2)]:border-b-0"
      style={{
        borderColor: pack.mood.ink + "1f",
        background: highlight ? pack.mood.background + "55" : "transparent",
      }}
    >
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: highlight ? pack.mood.accent : pack.mood.inkSoft }}
      >
        {label}
      </span>
      <span
        className="font-display text-[36px] leading-none tabular-nums"
        style={{ color: pack.mood.ink }}
      >
        {value}
      </span>
      {sub ? (
        <span
          className="text-[11px] font-medium leading-tight"
          style={{ color: pack.mood.inkSoft }}
        >
          {sub}
        </span>
      ) : null}
    </div>
  );
}

// ════════════════════════════════════════════════
// LAYOUT 2: PATISSERIE — Pack 2 (Backwelt, Lavender)
// Boutique-Patisserie: Polaroid-Bild rechts, italic display,
// elegante Übergänge, weiche Formen
// ════════════════════════════════════════════════
// ════════════════════════════════════════════════
// LAYOUT 2: PATISSERIE — Pack 1 (Bienes Backwelt, Lavender)
// ════════════════════════════════════════════════
// Magazin-Spread-Variante: lila Sidebar (40 %) hält Identity (Title,
// Polaroid, Mikros, Author, Reel-Link), cream Body (60 %) hält das
// eigentliche Rezept. Mirror der PDF-Variante in lib/pdf/recipe-card-pdf.tsx
// — gleiche Designentscheidungen, gleicher Aufbau, damit die Web-Vorschau
// 1:1 dem zeigt, was im Download-PDF steht.
//
// Mobil: Sidebar und Body stacken untereinander, alle Sub-Blöcke bleiben
// in der Sidebar sichtbar (Polaroid → Mikros → Author → Reel).
function PatisserieLayout({
  brand,
  pack,
  recipe,
  totalRecipes,
  enriching,
}: RecipeCardFullProps) {
  const totalTime = recipe.prepTime + (recipe.cookTime ?? 0);
  const portionsLabel = recipe.servings === 1 ? "Stück" : "Stücke";
  const stueckSing = "Stück";
  const grouped = groupIngredients(recipe.ingredients);
  const micros = (recipe.nutrition?.micros ?? []).slice(0, 8);
  const showStory =
    recipe.ingredients.length <= 10 && Boolean(recipe.description?.trim());

  return (
    <article
      className="mx-auto w-full max-w-[920px] overflow-hidden rounded-[var(--radius-card)] border"
      style={baseShellStyle(pack, brand)}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr]">
        {/* ─── LEFT: LAVENDER SIDEBAR ───────────────────────── */}
        {/* `min-w-0` auf das aside ist wichtig: Grid-Items haben default
            min-width=auto und wuerden sich vom laengsten enthaltenen Wort
            ausdehnen lassen. Bei Pack 1 (Patisserie) sind Titel wie
            "Erdbeer-Kuppeltorte" zusammengesetzte Substantive — ohne
            min-w-0 schiebt der Title die Sidebar breiter als 2fr und
            verschiebt die Body-Spalte nach rechts ueber den article-
            Rand hinaus, wo overflow-hidden den Text dann clipped. */}
        <aside
          className="flex min-w-0 flex-col gap-7 px-8 pt-10 pb-8 lg:px-9 lg:pt-12 lg:pb-10"
          style={{ background: pack.mood.background, color: pack.mood.ink }}
        >
          <div className="flex flex-col gap-5">
            {/* Pack caption — Recipe-Index-Anzeige bewusst weggelassen,
                weil Web-Detail-Pages immer eine einzelne Karte zeigen
                (siehe lib/pdf/recipe-pdf.tsx hideRecipeIndex). */}
            <span
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: pack.mood.inkSoft }}
            >
              {pack.title}
            </span>

            {/* Title — dynamische Schriftgroesse + aggressives Word-
                Wrapping. Stufen sind dieselben wie im PDF-Patisserie
                (lib/pdf/recipe-card-pdf.tsx#PatisseriePage), damit Web
                und PDF konsistent rendern. `[overflow-wrap:anywhere]`
                fuegt sich zu break-words + hyphens:auto dazu, weil
                manche Browser bei zusammengesetzten deutschen
                Substantiven mit Bindestrich (Erdbeer-Kuppeltorte,
                KI-Süsskartoffel-Muffins) sonst doch nicht umbrechen. */}
            <h1
              className={[
                "font-display italic tracking-[-0.015em]",
                "leading-[1.02] break-words [hyphens:auto] [overflow-wrap:anywhere]",
                recipe.title.length <= 14
                  ? "text-[44px] sm:text-[52px]"
                  : recipe.title.length <= 20
                    ? "text-[38px] sm:text-[46px]"
                    : recipe.title.length <= 26
                      ? "text-[32px] sm:text-[38px]"
                      : recipe.title.length <= 32
                        ? "text-[26px] sm:text-[32px]"
                        : recipe.title.length <= 40
                          ? "text-[22px] sm:text-[26px]"
                          : "text-[20px] sm:text-[24px]",
              ].join(" ")}
              style={{ color: pack.mood.ink }}
            >
              {recipe.title}
            </h1>
            <p
              className="font-display text-[15px] italic leading-snug"
              style={{ color: pack.mood.inkSoft }}
            >
              «&nbsp;{recipe.subtitle}&nbsp;»
            </p>

            {/* Polaroid hero */}
            <div className="relative pt-2">
              <div
                className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-md border-[8px] border-white pb-6"
                style={{
                  boxShadow:
                    "0 1px 0 rgba(0,0,0,0.04), 0 22px 40px -16px rgba(0,0,0,0.22)",
                  transform: "rotate(-2deg)",
                }}
              >
                <div className="relative aspect-square w-full overflow-hidden">
                  {enriching?.hero ? (
                    <HeroSkeleton pack={pack} shape="polaroid" />
                  ) : (
                    <Image
                      src={recipe.hero ?? pack.coverImage}
                      alt={recipe.title}
                      fill
                      sizes="(min-width: 1024px) 320px, 80vw"
                      className="object-cover content-fade-in"
                      priority
                      quality={95}
/>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Mikronährstoffe als vertikale Liste — der visuelle Move
              gegenüber den anderen 4 Layouts. Pack-Akzent treibt die
              %-Werte; Skeleton während Gemini noch generiert. */}
          {enriching?.micros ? (
            <div className="flex flex-col gap-3 pt-2">
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                style={{ color: pack.mood.accent }}
              >
                Reich an
              </span>
              <MicrosSkeletonStrip pack={pack} />
            </div>
          ) : micros.length > 0 ? (
            <div className="flex flex-col gap-2 pt-2">
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                style={{ color: pack.mood.accent }}
              >
                Reich an
              </span>
              <ul className="flex flex-col">
                {micros.map((m) => (
                  <li
                    key={m.name}
                    className="flex items-center gap-3 border-b py-1.5 text-[12px]"
                    style={{ borderColor: pack.mood.ink + "1f" }}
                  >
                    <span
                      className="flex-1 font-medium"
                      style={{ color: pack.mood.ink }}
                    >
                      {m.name}
                    </span>
                    <span
                      className="text-[10.5px]"
                      style={{ color: pack.mood.inkSoft }}
                    >
                      {m.amount}
                    </span>
                    {typeof m.pctDaily === "number" ? (
                      <span
                        className="font-display w-10 text-right text-[14px] italic"
                        style={{ color: pack.mood.ink }}
                      >
                        {Math.min(Math.max(m.pctDaily, 0), 100)}%
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Author block: Bienes Avatar im Lila-Rim-Kreis statt
              Bienen-Emoji. Schließt die Sidebar visuell. */}
          <div
            className="flex items-center gap-3 border-t pt-5"
            style={{ borderColor: pack.mood.accent + "55" }}
          >
            <span
              className="relative inline-block size-11 overflow-hidden rounded-full border-[1.5px]"
              style={{ borderColor: pack.mood.accent }}
            >
              <Image
                src={brand.avatar}
                alt={brand.name}
                fill
                sizes="44px"
                className="object-cover"
              />
            </span>
            <div className="flex flex-1 flex-col leading-tight">
              <span
                className="inline-flex items-center gap-1.5 font-display text-[15px] italic"
                style={{ color: pack.mood.ink }}
              >
                {brand.signature}
                <BeeIcon brandSlug={brand.slug} size={16} />
              </span>
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: pack.mood.inkSoft }}
              >
                {brand.handle}
              </span>
            </div>
          </div>

          {/* Reel-Link-Card — im Web kein QR (User scannt sich nicht
              selbst), sondern direkter Link zum Original-Reel. Im PDF
              wird dieselbe Stelle als QR-Stempel gerendert. */}
          {recipe.sourceUrl ? (
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-3 rounded-md border p-3 transition-opacity hover:opacity-90"
              style={{
                background: pack.mood.accent + "1f",
                borderColor: pack.mood.accent + "33",
              }}
            >
              <span
                className="grid size-10 place-items-center rounded-md bg-white"
                style={{ color: pack.mood.ink }}
                aria-hidden
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="3.5"
                    y="3.5"
                    width="17"
                    height="17"
                    rx="4.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M10 8.5v7l6-3.5-6-3.5Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <span className="flex flex-1 flex-col leading-tight">
                <span
                  className="font-display text-[13px] italic"
                  style={{ color: pack.mood.ink }}
                >
                  {recipe.sourceLabel ?? "Original-Reel ansehen"}
                </span>
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: pack.mood.inkSoft }}
                >
                  Im PDF als QR-Code
                </span>
              </span>
            </a>
          ) : null}
        </aside>

        {/* ─── RIGHT: CREAM BODY ────────────────────────────── */}
        <div
          className="flex flex-col gap-6 px-8 pt-10 pb-10 lg:px-10 lg:pt-12 lg:pb-12"
          style={{ background: brand.tokens.surface, color: pack.mood.ink }}
        >
          {/* Stats strip top */}
          <div
            className="flex flex-wrap items-baseline gap-x-5 gap-y-2 border-b pb-4"
            style={{ borderColor: pack.mood.ink + "1a" }}
          >
            <span className="flex items-baseline gap-1">
              <span
                className="font-display text-[22px] italic tracking-tight"
                style={{ color: pack.mood.ink }}
              >
                {totalTime}
              </span>
              <span
                className="text-[11px]"
                style={{ color: pack.mood.inkSoft }}
              >
                Min
              </span>
            </span>
            <span
              className="text-[11px] opacity-50"
              style={{ color: pack.mood.inkSoft }}
            >
              ·
            </span>
            <span className="flex items-baseline gap-1">
              <span
                className="font-display text-[22px] italic tracking-tight"
                style={{ color: pack.mood.ink }}
              >
                {recipe.servings}
              </span>
              <span
                className="text-[11px]"
                style={{ color: pack.mood.inkSoft }}
              >
                {portionsLabel}
              </span>
            </span>
            <span
              className="text-[11px] opacity-50"
              style={{ color: pack.mood.inkSoft }}
            >
              ·
            </span>
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: pack.mood.inkSoft }}
            >
              {recipe.difficulty}
            </span>
            <span
              className="ml-auto flex items-baseline gap-1"
              style={{ color: pack.mood.ink }}
            >
              <span
                className="font-display text-[22px] tracking-tight"
                style={{ color: pack.mood.ink }}
              >
                {recipe.nutrition.kcal}
              </span>
              <span
                className="text-[11px]"
                style={{ color: pack.mood.inkSoft }}
              >
                kcal {nutritionBasisInline(recipe.nutritionBasis)}
              </span>
            </span>
          </div>

          {/* Macros pills */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Eiweiß", value: `${recipe.nutrition.protein}g` },
              { label: "Kohlenhydrate", value: `${recipe.nutrition.carbs}g` },
              { label: "Fett", value: `${recipe.nutrition.fat}g` },
            ].map((m) => (
              <span
                key={m.label}
                className="inline-flex items-baseline gap-1.5 rounded-full px-3 py-1.5"
                style={{
                  background: pack.mood.background + "80",
                  color: pack.mood.ink,
                }}
              >
                <span className="font-display text-[14px] italic">
                  {m.value}
                </span>
                <span
                  className="text-[11px]"
                  style={{ color: pack.mood.inkSoft }}
                >
                  {m.label}
                </span>
              </span>
            ))}
          </div>

          {/* Bienes Story */}
          {showStory ? (
            <p
              className="border-l-[3px] pl-4 font-display text-[15px] italic leading-relaxed"
              style={{
                borderColor: pack.mood.accent,
                color: pack.mood.ink,
              }}
            >
              {recipe.description}
            </p>
          ) : null}

          {/* MAN NEHME */}
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2
                className="font-display text-[20px] italic tracking-tight"
                style={{ color: pack.mood.ink }}
              >
                Man nehme
              </h2>
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: pack.mood.inkSoft }}
              >
                für {recipe.servings} {portionsLabel}
              </span>
            </div>
            <SectionList
              recipe={recipe}
              pack={pack}
              kind="ingredients"
              headerStyle="italic"
              hideHeader
              groupedOverride={grouped}
            />
          </div>

          {/* ZUBEREITUNG */}
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2
                className="font-display text-[20px] italic tracking-tight"
                style={{ color: pack.mood.ink }}
              >
                Zubereitung
              </h2>
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: pack.mood.inkSoft }}
              >
                {recipe.steps.length} Schritte
              </span>
            </div>
            <SectionList
              recipe={recipe}
              pack={pack}
              kind="steps"
              headerStyle="italic"
              hideHeader
            />
          </div>
        </div>
      </div>
    </article>
  );
}



// ════════════════════════════════════════════════
// LAYOUT 3: MINIMAL — Pack 3 (Snacks, Mint)
// Apple-Vibe super clean: Recipe-Number 140px Hero,
// massive Whitespace, Bold Sans, kompakte Daten
// ════════════════════════════════════════════════
// ════════════════════════════════════════════════
// LAYOUT 3: COOKBOOK-COVER — Pack 3 (Bienes Snacks, Mint)
// ════════════════════════════════════════════════
// Komplett anderer Move als Pack 1 (Vertikal-Split) und alle anderen
// Layouts: Hero-Bild fuellt die obere Haelfte als Cookbook-Cover (full-
// bleed), Title als Mega-Display-Overlay unten links auf dem Bild, Pack-
// Caption oben links, Bienes Avatar als Stempel rechts unten auf dem
// Hero. Darunter Apple-Spec-Strip (Mint-Tile mit kcal/Eiweiss/Fett/Zeit/
// Stueck), Body in 2 Spalten, Mikros als horizontale Capsule-Pills.
// Footer mit Avatar + Signature + Mint-getoentem QR-Stempel.
//
// Title-Sicherheit von Anfang an: dynamische Schriftgroesse je Laenge,
// break-words + hyphens:auto, damit Titel wie "Frozen Coconut &
// Strawberry Cups" oder "Marzipankartoffeln" beide perfekt sitzen.
//
// Mirror der PDF-Variante (lib/pdf/recipe-card-pdf.tsx#MinimalPage),
// damit Web-Vorschau und PDF-Download visuell identisch sind.
function MinimalLayout({
  brand,
  pack,
  recipe,
  totalRecipes,
  enriching,
}: RecipeCardFullProps) {
  const totalTime = recipe.prepTime + (recipe.cookTime ?? 0);
  const portionsLabel = recipe.servings === 1 ? "Portion" : "Stücke";
  const stueckSing = recipe.servings === 1 ? "Portion" : "Stück";
  const grouped = groupIngredients(recipe.ingredients);
  const micros = (recipe.nutrition?.micros ?? []).slice(0, 9);
  const titleLen = recipe.title.length;

  return (
    <article
      className="mx-auto w-full max-w-[920px] overflow-hidden rounded-[var(--radius-card)] border bg-white"
      style={baseShellStyle(pack, brand)}
    >
      {/* ─── HERO mit Title-Overlay ─────────────────────────────── */}
      <div className="relative h-[440px] w-full overflow-hidden sm:h-[520px]">
        {enriching?.hero ? (
          <HeroSkeleton pack={pack} />
        ) : (
          <Image
            src={recipe.hero ?? pack.coverImage}
            alt={recipe.title}
            fill
            sizes="(min-width: 1024px) 920px, 100vw"
            className="object-cover content-fade-in"
            priority
            quality={95}
/>
        )}
        {/* Dunkler Gradient unten — sicherer Kontrast fuer Title */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%]"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0))",
          }}
        />

        {/* Top strip — Pack-Caption + Recipe-Number, weiss */}
        <div className="absolute inset-x-0 top-0 flex items-center px-7 pt-7 sm:px-10 sm:pt-9">
          <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-white">
            {pack.title}
          </span>
        </div>

        {/* Avatar Stempel rechts unten auf dem Hero */}
        <div className="absolute bottom-7 right-7 sm:bottom-9 sm:right-10">
          <span
            className="relative inline-block size-[60px] overflow-hidden rounded-full border-[2.5px] border-white shadow-[0_4px_18px_-4px_rgba(0,0,0,0.4)] sm:size-[68px]"
            aria-hidden
          >
            <Image
              src={brand.avatar}
              alt={brand.name}
              fill
              sizes="68px"
              className="object-cover"
            />
          </span>
        </div>

        {/* Title overlay unten links — dynamische Skala je Title-Laenge */}
        <div className="absolute inset-x-0 bottom-0 px-7 pb-7 pr-[110px] sm:px-10 sm:pb-9 sm:pr-[140px]">
          <h1
            className={[
              "font-sans font-bold leading-[1.02] tracking-[-0.02em]",
              "break-words [hyphens:auto] text-white",
              "drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]",
              titleLen <= 18
                ? "text-[44px] sm:text-[64px]"
                : titleLen <= 24
                  ? "text-[36px] sm:text-[52px]"
                  : titleLen <= 32
                    ? "text-[30px] sm:text-[42px]"
                    : titleLen <= 40
                      ? "text-[26px] sm:text-[36px]"
                      : "text-[22px] sm:text-[30px]",
            ].join(" ")}
          >
            {recipe.title}
          </h1>
          <p className="font-display mt-2 text-[14px] italic leading-snug text-white/90 sm:text-[16px]">
            {recipe.subtitle}
          </p>
        </div>
      </div>

      {/* ─── SPEC STRIP (Mint Hintergrund, Apple-Spec-Style) ────── */}
      <div
        className="grid grid-cols-3 gap-3 px-7 py-4 sm:grid-cols-6 sm:px-10 sm:py-5"
        style={{ background: pack.mood.background }}
      >
        {[
          {
            value: String(recipe.nutrition.kcal),
            label: `kcal pro ${stueckSing}`,
          },
          { value: `${recipe.nutrition.protein}g`, label: "Eiweiß" },
          { value: `${recipe.nutrition.carbs}g`, label: "Kohlenhydrate" },
          { value: `${recipe.nutrition.fat}g`, label: "Fett" },
          { value: `${totalTime}`, label: "Min total" },
          {
            value: String(recipe.servings),
            label: portionsLabel,
          },
        ].map((s, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-0.5 text-center"
          >
            <span
              className="font-sans text-[20px] font-bold leading-none tabular-nums sm:text-[22px]"
              style={{ color: pack.mood.ink }}
            >
              {s.value}
            </span>
            <span
              className="text-[9.5px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: pack.mood.inkSoft }}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* ─── BIENES STORY — bei kurzen Snacks (3-Zutaten-Frozen-Cup,
          5-Min-Marzipankartoffeln) sonst wirkt das 2-Spalten-Body
          halbleer auf dem grosszuegigen Minimal-Hero. ────────── */}
      {webShouldShowStory(recipe) ? (
        <WebStoryBlock
          recipe={recipe}
          pack={pack}
          className="border-b px-7 py-6 sm:px-10 sm:py-7"
        />
      ) : null}

      {/* ─── BODY: 2-Spalten ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-10 px-7 pt-9 pb-8 sm:px-10 lg:grid-cols-[260px_1fr] lg:gap-14 lg:pt-12 lg:pb-10">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.26em]"
              style={{ color: pack.mood.accent }}
            >
              Man nehme
            </span>
            <span
              className="block h-[2px] w-[24px]"
              style={{ background: pack.mood.accent }}
            />
          </div>
          <SectionList
            recipe={recipe}
            pack={pack}
            kind="ingredients"
            hideHeader
            groupedOverride={grouped}
            minimal
          />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.26em]"
              style={{ color: pack.mood.accent }}
            >
              Zubereitung
            </span>
            <span
              className="block h-[2px] w-[24px]"
              style={{ background: pack.mood.accent }}
            />
          </div>
          <SectionList recipe={recipe} pack={pack} kind="steps" hideHeader minimal />
        </div>
      </div>

      {/* ─── MIKROS-STRIP als Capsule-Pills ────────────────────── */}
      {enriching?.micros ? (
        <div
          className="border-t px-7 py-5 sm:px-10"
          style={{
            background: pack.mood.background + "80",
            borderColor: pack.mood.accent + "33",
          }}
        >
          <span
            className="mb-3 block text-[10px] font-bold uppercase tracking-[0.22em]"
            style={{ color: pack.mood.accent }}
          >
            Reich an
          </span>
          <MicrosSkeletonStrip pack={pack} />
        </div>
      ) : micros.length > 0 ? (
        <div
          className="border-t px-7 py-5 sm:px-10"
          style={{
            background: pack.mood.background + "80",
            borderColor: pack.mood.accent + "33",
          }}
        >
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.22em]"
              style={{ color: pack.mood.accent }}
            >
              Reich an
            </span>
            <span
              className="text-[9.5px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: pack.mood.inkSoft }}
            >
              Mikronährstoffe pro {stueckSing} · % Tagesbedarf
            </span>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {micros.map((m) => (
              <li
                key={m.name}
                className="inline-flex items-baseline gap-1.5 rounded-full border bg-white px-3 py-1.5"
                style={{ borderColor: pack.mood.accent + "55" }}
              >
                <span
                  className="text-[12px] font-semibold"
                  style={{ color: pack.mood.ink }}
                >
                  {m.name}
                </span>
                <span
                  className="text-[11px]"
                  style={{ color: pack.mood.inkSoft }}
                >
                  {m.amount}
                </span>
                {typeof m.pctDaily === "number" ? (
                  <span
                    className="text-[12px] font-bold"
                    style={{ color: pack.mood.accent }}
                  >
                    {Math.min(Math.max(m.pctDaily, 0), 100)}%
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ─── FOOTER mit Avatar + Signatur + Reel-Link-Card ─────── */}
      <div
        className="flex flex-wrap items-center justify-between gap-4 border-t px-7 py-5 sm:px-10"
        style={{ borderColor: pack.mood.ink + "12" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="relative inline-block size-9 overflow-hidden rounded-full border-[1.4px]"
            style={{ borderColor: pack.mood.accent }}
          >
            <Image
              src={brand.avatar}
              alt={brand.name}
              fill
              sizes="36px"
              className="object-cover"
            />
          </span>
          <div className="flex flex-col leading-tight">
            <span
              className="inline-flex items-center gap-1.5 font-display text-[15px] italic"
              style={{ color: pack.mood.ink }}
            >
              {brand.signature}
              <BeeIcon brandSlug={brand.slug} size={16} />
            </span>
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: pack.mood.inkSoft }}
            >
              {brand.handle} · {pack.title}
            </span>
          </div>
        </div>

        {recipe.sourceUrl ? (
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-3 rounded-md border px-3 py-2 transition-opacity hover:opacity-90"
            style={{
              background: pack.mood.accent + "1f",
              borderColor: pack.mood.accent + "33",
            }}
          >
            <span className="flex flex-col leading-tight text-right">
              <span
                className="font-display text-[12px] italic"
                style={{ color: pack.mood.ink }}
              >
                {recipe.sourceLabel ?? "Original-Reel ansehen"}
              </span>
              <span
                className="text-[9.5px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: pack.mood.inkSoft }}
              >
                Im PDF als QR-Code
              </span>
            </span>
            <span
              className="grid size-9 place-items-center rounded-md bg-white"
              style={{ color: pack.mood.ink }}
              aria-hidden
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect
                  x="3.5"
                  y="3.5"
                  width="17"
                  height="17"
                  rx="4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path d="M10 8.5v7l6-3.5-6-3.5Z" fill="currentColor" />
              </svg>
            </span>
          </a>
        ) : null}
      </div>
    </article>
  );
}

function MinStat({
  value,
  label,
  sublabel,
  pack,
}: {
  value: string;
  label: string;
  sublabel?: string;
  pack: Pack;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className="font-sans text-[22px] font-bold tabular-nums"
        style={{ color: pack.mood.ink }}
      >
        {value}
      </span>
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: pack.mood.inkSoft }}
      >
        {label}
      </span>
      {sublabel ? (
        <span
          className="text-[8px] font-medium uppercase tracking-[0.06em] opacity-70"
          style={{ color: pack.mood.inkSoft }}
        >
          {sublabel}
        </span>
      ) : null}
    </div>
  );
}

// ════════════════════════════════════════════════
// LAYOUT 4: SPORT (Volumen-Editorial) — Pack 2 (Volumen-Wunder, Sage Green)
// XL-Mahlzeit-Showcase: Foto rechts OHNE Overlay (Bild ist der Hero), italic
// Fraunces title links, 3-Tile Volumen-Stats mit Emojis, visuelle Macro-Bars,
// ☐-Checklist-Zutaten und Schritt-Timeline mit Verbindungslinien.
//
// Adaptiv für Edge-Cases: bei sparse content (≤6 Zutaten — 3-Zutaten-Eisbowl
// als Härtefall) blendet sich automatisch ein "Bienes Story"-Block aus
// `recipe.description` ein und Zutaten-Rows werden größer + luftiger, damit
// kurze Karten nicht halbleer wirken. Lange Karten (16-Zutaten-Mexican-Bowl)
// bleiben dicht und funktional.
// ════════════════════════════════════════════════
function SportLayout({
  brand,
  pack,
  recipe,
  totalRecipes,
  enriching,
}: RecipeCardFullProps) {
  const totalTime = recipe.prepTime + (recipe.cookTime ?? 0);
  const portionsLabel = recipe.servings === 1 ? "Portion" : "Portionen";
  // Sparse-content signal — short recipes get a Story block + larger rows.
  const isSparse = recipe.ingredients.length <= 6;

  // Macro bars — visualise the "high protein at low kcal" promise of the
  // Volumen-Wunder pack. Maxes are pack-typical (≤450 kcal, ≥30g protein).
  const macroBars = [
    {
      label: "Eiweiß",
      value: recipe.nutrition.protein,
      max: 50,
      unit: "g",
      emoji: "💪",
    },
    {
      label: "Kohlenhydrate",
      value: recipe.nutrition.carbs,
      max: 80,
      unit: "g",
      emoji: "🌾",
    },
    {
      label: "Fett",
      value: recipe.nutrition.fat,
      max: 35,
      unit: "g",
      emoji: "🥑",
    },
  ];

  return (
    <article
      className="mx-auto w-full max-w-[940px] overflow-hidden rounded-[var(--radius-card)] border bg-white"
      style={baseShellStyle(pack, brand)}
    >
      {/* HERO — square photo right (no overlay), editorial title left */}
      <header
        className="grid grid-cols-1 gap-8 border-b px-8 pt-10 pb-8 sm:px-12 sm:pt-12 lg:grid-cols-[1.2fr_1fr] lg:gap-10"
        style={{
          background: pack.mood.background + "30",
          borderColor: pack.mood.ink + "1a",
        }}
      >
        <div className="flex flex-col gap-4">
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: pack.mood.inkSoft }}
          >
            {pack.title}
          </span>
          <h1
            className="font-display text-[44px] italic leading-[0.96] tracking-[-0.01em] sm:text-[56px]"
            style={{ color: pack.mood.ink }}
          >
            {recipe.title}
          </h1>
          <p
            className="font-display text-[18px] italic leading-snug"
            style={{ color: pack.mood.inkSoft }}
          >
            «&nbsp;{recipe.subtitle}&nbsp;»
          </p>
          <div
            className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]"
            style={{ color: pack.mood.inkSoft }}
          >
            <span>{totalTime} Min</span>
            <span>·</span>
            <span>{recipe.difficulty}</span>
            <span>·</span>
            <span>
              ergibt {recipe.servings} {portionsLabel}
            </span>
          </div>
          {recipe.tags?.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {recipe.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]"
                  style={{
                    background: pack.mood.background + "80",
                    color: pack.mood.ink,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="relative">
          <div
            className="relative mx-auto aspect-square w-full max-w-[340px] overflow-hidden rounded-2xl lg:ml-auto"
            style={{
              boxShadow:
                "0 1px 0 rgba(43,31,25,0.05), 0 22px 40px -16px rgba(43,31,25,0.22)",
            }}
          >
            {enriching?.hero ? (
              <HeroSkeleton pack={pack} />
            ) : (
              <Image
                src={recipe.hero ?? pack.coverImage}
                alt={recipe.title}
                fill
                sizes="(min-width: 1024px) 340px, 100vw"
                className="object-cover content-fade-in"
                priority
                quality={95}
/>
            )}
          </div>
        </div>
      </header>

      {/* BIENES STORY — wird angezeigt sobald das Rezept kurz genug ist,
          dass die Karte ohne Erzähl-Block halbleer wirken würde (≤10
          Zutaten). Vorher war die Schwelle hier nur ≤6 (isSparse), das
          war strenger als das PDF und führte dazu dass Web und PDF bei
          7-10-Zutaten-Karten unterschiedlich aussahen. webShouldShowStory
          ist jetzt der gemeinsame Helper für alle Web-Layouts. */}
      {webShouldShowStory(recipe) ? (
        <WebStoryBlock recipe={recipe} pack={pack} />
      ) : null}

      {/* VOLUMEN-STATS — 3 prominent tiles with emojis */}
      <div
        className="grid grid-cols-3 border-b"
        style={{ borderColor: pack.mood.ink + "1f" }}
      >
        <VolumenStat
          emoji="🥄"
          value={`${recipe.servings}×`}
          label={portionsLabel}
          pack={pack}
        />
        <VolumenStat
          emoji="🔥"
          value={String(recipe.nutrition.kcal)}
          label={`kcal ${nutritionBasisInline(recipe.nutritionBasis)}`}
          pack={pack}
          highlight
        />
        <VolumenStat
          emoji="💪"
          value={`${recipe.nutrition.protein}g`}
          label={`Eiweiß ${nutritionBasisInline(recipe.nutritionBasis)}`}
          pack={pack}
        />
      </div>

      {/* MACRO BARS — visualise the protein-density story */}
      <div
        className="border-b px-8 py-6 sm:px-12"
        style={{ borderColor: pack.mood.ink + "1f" }}
      >
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2
            className="text-[12px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: pack.mood.accent }}
          >
            Makros
          </h2>
          <span
            className="text-[10px] font-medium uppercase tracking-[0.14em]"
            style={{ color: pack.mood.inkSoft }}
          >
            {nutritionBasisInline(recipe.nutritionBasis)} · von 50 / 80 / 35 g Skala
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {macroBars.map((m) => (
            <div
              key={m.label}
              className="grid grid-cols-[8.5rem_1fr_3rem] items-center gap-4"
            >
              <div className="flex items-center gap-2">
                <span className="text-[14px]" aria-hidden>
                  {m.emoji}
                </span>
                <span
                  className="text-[12px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: pack.mood.inkSoft }}
                >
                  {m.label}
                </span>
              </div>
              <div
                className="h-2.5 overflow-hidden rounded-full"
                style={{ background: pack.mood.ink + "12" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min((m.value / m.max) * 100, 100)}%`,
                    background: pack.mood.accent,
                  }}
                />
              </div>
              <span
                className="text-right font-display text-[18px] tabular-nums"
                style={{ color: pack.mood.ink }}
              >
                {m.value}
                {m.unit}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* BODY — Zutaten-Cart (☐) + Schritt-Timeline */}
      <div className="grid grid-cols-1 gap-10 px-8 py-10 sm:px-12 lg:grid-cols-[1fr_1.4fr] lg:gap-14">
        {/* Zutaten-Cart with checkboxes */}
        <section>
          <div
            className="flex items-baseline justify-between gap-3 border-b pb-3"
            style={{ borderColor: pack.mood.ink + "20" }}
          >
            <h2
              className="text-[12px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: pack.mood.accent }}
            >
              Zutaten-Cart
            </h2>
            <span
              className="text-[10px] font-medium uppercase tracking-[0.14em]"
              style={{ color: pack.mood.inkSoft }}
            >
              {recipe.ingredients.length} Items · zum Abhaken
            </span>
          </div>
          <ul className="mt-5 flex flex-col">
            {groupIngredients(recipe.ingredients).map((group, gIdx) => (
              <li key={`g-${gIdx}`} className="contents">
                {group.name ? (
                  <li
                    className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${gIdx > 0 ? "mt-3" : ""} pb-1.5`}
                    style={{ color: pack.mood.accent }}
                  >
                    {group.name}
                  </li>
                ) : null}
                {group.items.map((ing, idx) => (
              <li
                key={`${ing.name}-${gIdx}-${idx}`}
                className={`grid grid-cols-[1.25rem_4rem_1fr] items-baseline gap-3 border-b ${
                  isSparse ? "py-3" : "py-2"
                }`}
                style={{ borderColor: pack.mood.ink + "10" }}
              >
                <span
                  className="text-[16px] leading-none"
                  style={{ color: pack.mood.accent + "90" }}
                  aria-hidden
                >
                  ☐
                </span>
                <span
                  className="font-mono text-[12px] tabular-nums"
                  style={{ color: pack.mood.inkSoft }}
                >
                  {ing.amount}
                </span>
                <span
                  className={`leading-snug ${
                    isSparse ? "text-[15px]" : "text-[14px]"
                  }`}
                  style={{ color: pack.mood.ink }}
                >
                  {ing.name}
                  {ing.note ? (
                    <span
                      className="block text-[11px] italic"
                      style={{ color: pack.mood.inkSoft }}
                    >
                      {ing.note}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
              </li>
            ))}
          </ul>
        </section>

        {/* Schritt-Timeline with connecting lines */}
        <section>
          <div
            className="flex items-baseline justify-between gap-3 border-b pb-3"
            style={{ borderColor: pack.mood.ink + "20" }}
          >
            <h2
              className="text-[12px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: pack.mood.accent }}
            >
              Timeline
            </h2>
            <span
              className="text-[10px] font-medium uppercase tracking-[0.14em]"
              style={{ color: pack.mood.inkSoft }}
            >
              {recipe.steps.length} Schritte · {totalTime} Min total
            </span>
          </div>
          <ol className="mt-5 flex flex-col">
            {groupRecipeSteps(recipe.steps).map((group, gIdx) => (
              <li key={`sg-${gIdx}`} className="contents">
                {group.name ? (
                  <li
                    className="pb-3 text-[11px] font-semibold uppercase tracking-[0.22em]"
                    style={{
                      color: pack.mood.accent,
                      paddingTop: gIdx > 0 ? "0.5rem" : 0,
                    }}
                  >
                    {group.name}
                  </li>
                ) : null}
                {group.items.map((item) => {
                  const isLast = item.index === recipe.steps.length - 1;
                  return (
                    <li
                      key={item.index}
                      className="grid grid-cols-[2.4rem_1fr] gap-3 pb-5 last:pb-0"
                    >
                      <div className="flex flex-col items-center">
                        <span
                          className="font-display text-[28px] leading-none tabular-nums"
                          style={{ color: pack.mood.accent }}
                        >
                          {item.index + 1}
                        </span>
                        {!isLast ? (
                          <span
                            className="mt-2 block w-0.5 flex-1"
                            style={{
                              background: pack.mood.accent + "30",
                              minHeight: 32,
                            }}
                            aria-hidden
                          />
                        ) : null}
                      </div>
                      <span
                        className="text-[15px] leading-[1.55]"
                        style={{ color: pack.mood.ink }}
                      >
                        {item.text}
                      </span>
                    </li>
                  );
                })}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <CardFooter brand={brand} pack={pack} recipe={recipe} enriching={enriching} />
    </article>
  );
}

function VolumenStat({
  emoji,
  value,
  label,
  pack,
  highlight = false,
}: {
  emoji: string;
  value: string;
  label: string;
  pack: Pack;
  highlight?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center gap-1.5 border-r px-3 py-7 text-center last:border-r-0"
      style={{
        borderColor: pack.mood.ink + "1f",
        background: highlight ? pack.mood.background + "55" : "transparent",
      }}
    >
      <span className="text-[24px] leading-none" aria-hidden>
        {emoji}
      </span>
      <span
        className="font-display text-[36px] leading-none tabular-nums"
        style={{ color: pack.mood.ink }}
      >
        {value}
      </span>
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: highlight ? pack.mood.accent : pack.mood.inkSoft }}
      >
        {label}
      </span>
    </div>
  );
}


// ════════════════════════════════════════════════
// LAYOUT 6: VITAL (Premium-Stack) — Pack 2 (Volumen-Wunder, Sage Green)
// Drei gestapelte Premium-Cards mit Sage-Akzent-Borders.
// Card 1: Hero + Title + Avatar-Stempel
// Card 2: Donut-Ringe (Macros) + Mikronaehrstoff-Pearl-Strip
// Card 3: Body 2-Spalten (Zutaten links, Anweisungen rechts)
//
// Mirrors VitalPage in lib/pdf/recipe-card-pdf.tsx — gleicher Look,
// gleiche Density, gleiche Donut-Visualisierung.
// ════════════════════════════════════════════════
function VitalLayout({
  brand,
  pack,
  recipe,
  totalRecipes,
  enriching,
}: RecipeCardFullProps) {
  const totalTime = recipe.prepTime + (recipe.cookTime ?? 0);
  const portionsLbl = recipe.servings === 1 ? "Portion" : "Portionen";
  const grouped = groupIngredients(recipe.ingredients);
  const stepsArr = recipe.steps ?? [];
  const macros = [
    { label: "Eiweiß", value: recipe.nutrition.protein, max: 50, unit: "g" },
    { label: "Kohlenh.", value: recipe.nutrition.carbs, max: 80, unit: "g" },
    { label: "Fett", value: recipe.nutrition.fat, max: 35, unit: "g" },
  ];
  const micros = (recipe.nutrition.micros ?? []).slice(0, 8);

  const cardClass =
    "rounded-3xl border bg-white p-6 sm:p-7 shadow-[0_1px_0_rgba(43,31,25,0.04),0_22px_46px_-22px_rgba(43,31,25,0.18)]";
  const cardBorder = pack.mood.accent + "55";

  // Step-Items normalisieren (string | { text, group })
  const normSteps = stepsArr.map((s) =>
    typeof s === "string" ? { text: s, group: undefined as string | undefined } : s
  );

  return (
    <div
      className="mx-auto flex w-full max-w-[940px] flex-col gap-3"
      style={{ background: "transparent" }}
    >
      {/* TOP STRIP — nur Pack-Info, kein Recipe-Index (siehe
          lib/pdf/recipe-pdf.tsx hideRecipeIndex) */}
      <div
        className="flex items-center px-2 text-[10.5px] font-semibold uppercase tracking-[0.22em]"
        style={{ color: pack.mood.inkSoft }}
      >
        <span>
          Pack {String(pack.number).padStart(2, "0")} · {pack.title}
        </span>
      </div>

      {/* CARD 1 — HERO */}
      <article
        className={cardClass}
        style={{ borderColor: cardBorder }}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
          {/* Hero */}
          <div
            className="relative aspect-square w-full max-w-[180px] shrink-0 overflow-hidden rounded-2xl border sm:w-[180px]"
            style={{ borderColor: pack.mood.accent + "70" }}
          >
            {enriching?.hero ? (
              <HeroSkeleton pack={pack} />
            ) : (
              <Image
                src={recipe.hero ?? pack.coverImage}
                alt={recipe.title}
                fill
                sizes="(min-width: 640px) 180px, 100vw"
                className="object-cover content-fade-in"
                priority
                quality={95}
/>
            )}
          </div>

          {/* Title-Block */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span
              className="text-[10.5px] font-bold uppercase tracking-[0.24em]"
              style={{ color: pack.mood.accent }}
            >
              High Protein · Volumen
            </span>
            <h1
              className="font-display text-[34px] italic leading-[0.96] tracking-[-0.01em] sm:text-[44px]"
              style={{ color: pack.mood.ink }}
            >
              {recipe.title}
            </h1>
            {recipe.subtitle ? (
              <p
                className="font-display text-[15px] italic leading-snug"
                style={{ color: pack.mood.inkSoft }}
              >
                «&nbsp;{recipe.subtitle}&nbsp;»
              </p>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <VitalMetaPill label={`${totalTime} Min`} pack={pack} />
              <VitalMetaPill label={recipe.difficulty} pack={pack} />
              <VitalMetaPill
                label={`${recipe.servings}× ${portionsLbl}`}
                pack={pack}
              />
            </div>
          </div>

          {/* Avatar-Stempel */}
          <div
            className="hidden size-[72px] shrink-0 overflow-hidden rounded-full border-2 p-[3px] sm:block"
            style={{
              borderColor: pack.mood.accent,
              background: "white",
            }}
          >
            <div className="size-full overflow-hidden rounded-full">
              <Image
                src={brand.avatar}
                alt={brand.name}
                width={66}
                height={66}
                className="size-full object-cover"
              />
            </div>
          </div>
        </div>
      </article>

      {/* CARD 1.5 — BIENES STORY (sparse-only). Eigene Card im Stack-
          Rhythmus, damit der Premium-Card-Look erhalten bleibt. Nur
          gerendert wenn das Rezept kurz genug ist (≤10 Zutaten via
          webShouldShowStory) — sonst wuerde es den Stack ueberladen. */}
      {webShouldShowStory(recipe) ? (
        <article
          className={cardClass}
          style={{ borderColor: cardBorder }}
        >
          <span
            className="mb-2 block text-[10.5px] font-bold uppercase tracking-[0.22em]"
            style={{ color: pack.mood.accent }}
          >
            Story
          </span>
          <p
            className="max-w-[60ch] font-display text-[17px] italic leading-relaxed"
            style={{ color: pack.mood.ink }}
          >
            {recipe.description}
          </p>
        </article>
      ) : null}

      {/* CARD 2 — NUTRITION */}
      <article
        className={cardClass}
        style={{ borderColor: cardBorder }}
      >
        <div className="mb-5 flex items-center justify-between">
          <span
            className="text-[10.5px] font-bold uppercase tracking-[0.22em]"
            style={{ color: pack.mood.inkSoft }}
          >
            Nährstoff-Profil ·{" "}
            {recipe.nutritionBasis === "piece"
              ? "pro Stück"
              : recipe.nutritionBasis === "per100g"
                ? "pro 100 g"
                : recipe.nutritionBasis === "total"
                  ? "gesamt"
                  : "pro Portion"}
          </span>
          <div
            className="flex items-baseline gap-1"
            style={{ color: pack.mood.ink }}
          >
            {enriching?.micros ? (
              <span
                className="block h-7 w-14 animate-pulse rounded-md"
                style={{ background: pack.mood.accent + "30" }}
              />
            ) : (
              <span className="font-display text-[28px] leading-none">
                {recipe.nutrition.kcal}
              </span>
            )}
            <span
              className="text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ color: pack.mood.inkSoft }}
            >
              kcal
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-7">
          {/* Donut-Ringe */}
          <div className="flex items-start gap-5">
            {macros.map((m) => (
              <VitalMacroDonut
                key={m.label}
                label={m.label}
                value={m.value}
                max={m.max}
                unit={m.unit}
                accent={pack.mood.accent}
                ringBg={pack.mood.accent + "33"}
                ink={pack.mood.ink}
                inkSoft={pack.mood.inkSoft}
              />
            ))}
          </div>

          {/* Mikros */}
          <div
            className="flex-1 lg:border-l lg:pl-6"
            style={{ borderColor: pack.mood.accent + "33" }}
          >
            <div
              className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{ color: pack.mood.inkSoft }}
            >
              Reich an · % Tagesbedarf
            </div>
            {enriching?.micros ? (
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <span
                    key={i}
                    className="block h-6 w-24 animate-pulse rounded-full"
                    style={{
                      background: pack.mood.accent + "20",
                      animationDelay: `${i * 80}ms`,
                    }}
                  />
                ))}
              </div>
            ) : micros.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {micros.map((m) => (
                  <span
                    key={m.name}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]"
                    style={{
                      borderColor: pack.mood.accent + "55",
                      background: pack.mood.accent + "12",
                    }}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: pack.mood.accent }}
                    />
                    <span
                      className="font-semibold"
                      style={{ color: pack.mood.ink }}
                    >
                      {m.name}
                    </span>
                    <span style={{ color: pack.mood.inkSoft }}>
                      {m.amount}
                    </span>
                    {m.pctDaily ? (
                      <span
                        className="font-bold"
                        style={{ color: pack.mood.accent }}
                      >
                        {m.pctDaily}%
                      </span>
                    ) : null}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </article>

      {/* CARD 3 — BODY */}
      <article
        className={cardClass}
        style={{ borderColor: cardBorder }}
      >
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
          {/* ZUTATEN */}
          <div
            className="lg:border-r lg:pr-7"
            style={{ borderColor: pack.mood.accent + "30" }}
          >
            <div
              className="mb-4 text-[10.5px] font-bold uppercase tracking-[0.22em]"
              style={{ color: pack.mood.accent }}
            >
              Zutaten · {recipe.ingredients.length} Items
            </div>
            <div className="flex flex-col">
              {grouped.map((group, gi) => (
                <div
                  key={gi}
                  className={gi < grouped.length - 1 ? "mb-4" : ""}
                >
                  {group.name ? (
                    <div
                      className="mb-1.5 font-display text-[14px] italic"
                      style={{ color: pack.mood.inkSoft }}
                    >
                      {group.name}
                    </div>
                  ) : null}
                  {group.items.map((ing, ii) => (
                    <div
                      key={ii}
                      className="flex gap-3 border-b py-2 last:border-b-0"
                      style={{ borderColor: pack.mood.accent + "26" }}
                    >
                      <span
                        className="w-14 shrink-0 text-[12.5px] font-semibold"
                        style={{ color: pack.mood.accent }}
                      >
                        {ing.amount || "n. A."}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span
                          className="text-[13px] leading-snug"
                          style={{ color: pack.mood.ink }}
                        >
                          {ing.name}
                        </span>
                        {ing.note ? (
                          <span
                            className="mt-0.5 text-[11px] italic leading-snug"
                            style={{ color: pack.mood.inkSoft }}
                          >
                            {ing.note}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* ANWEISUNGEN */}
          <div>
            <div
              className="mb-4 text-[10.5px] font-bold uppercase tracking-[0.22em]"
              style={{ color: pack.mood.accent }}
            >
              Anweisungen · {normSteps.length} Schritte · {totalTime} Min
            </div>
            <ol className="flex flex-col gap-3.5">
              {normSteps.map((step, si) => (
                <li key={si} className="flex gap-3">
                  <span
                    className="w-7 shrink-0 pt-0.5 font-display text-[20px] leading-none"
                    style={{ color: pack.mood.accent }}
                  >
                    {String(si + 1).padStart(2, "0")}
                  </span>
                  <span
                    className="flex-1 text-[13px] leading-relaxed"
                    style={{ color: pack.mood.ink }}
                  >
                    {step.text}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </article>

      {/* FOOTER — Brand-Signatur + QR */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 pt-2">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex items-center gap-1.5 font-display text-[16px] italic"
            style={{ color: pack.mood.ink }}
          >
            {brand.signature}
            <BeeIcon brandSlug={brand.slug} size={17} />
          </span>
          <span
            className="text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ color: pack.mood.inkSoft }}
          >
            {brand.handle} · {pack.title}
          </span>
        </div>
        {recipe.sourceUrl ? (
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-opacity hover:opacity-80"
            style={{
              borderColor: pack.mood.accent + "55",
              background: pack.mood.accent + "18",
              color: pack.mood.ink,
            }}
          >
            <span>Original-Reel</span>
            <span aria-hidden style={{ color: pack.mood.accent }}>
              →
            </span>
          </a>
        ) : null}
      </div>
    </div>
  );
}

function VitalMetaPill({ label, pack }: { label: string; pack: Pack }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold"
      style={{
        borderColor: pack.mood.accent + "55",
        background: pack.mood.accent + "12",
        color: pack.mood.ink,
      }}
    >
      {label}
    </span>
  );
}

function VitalMacroDonut({
  label,
  value,
  max,
  unit,
  accent,
  ringBg,
  ink,
  inkSoft,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  accent: string;
  ringBg: string;
  ink: string;
  inkSoft: string;
}) {
  const r = 24;
  const cx = 30;
  const cy = 30;
  const sweep = Math.min(360, (value / max) * 360);
  const arcPath = (() => {
    if (sweep <= 0) return "";
    if (sweep >= 359.9) {
      return `M ${cx},${cy - r} A ${r},${r} 0 1,1 ${cx - 0.001},${cy - r}`;
    }
    const rad = (sweep * Math.PI) / 180;
    const ex = cx + r * Math.sin(rad);
    const ey = cy - r * Math.cos(rad);
    const large = sweep > 180 ? 1 : 0;
    return `M ${cx},${cy - r} A ${r},${r} 0 ${large},1 ${ex.toFixed(3)},${ey.toFixed(3)}`;
  })();
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative size-[60px]">
        <svg
          viewBox="0 0 60 60"
          className="absolute inset-0 size-full"
          aria-hidden
        >
          <circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={ringBg}
            strokeWidth={4.5}
            fill="none"
          />
          {arcPath ? (
            <path
              d={arcPath}
              stroke={accent}
              strokeWidth={4.5}
              fill="none"
              strokeLinecap="round"
            />
          ) : null}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-display text-[14px] leading-none"
            style={{ color: ink }}
          >
            {value}
            {unit}
          </span>
        </div>
      </div>
      <span
        className="text-[9.5px] font-bold uppercase tracking-[0.16em]"
        style={{ color: inkSoft }}
      >
        {label}
      </span>
    </div>
  );
}


// ════════════════════════════════════════════════
// LAYOUT 7: AMBER (Sunset-Editorial Premium) — Pack 5 (Feierabend, Honey)
// Hero zentriert mit Honey-Glow-Halo, Avatar-Stempel oben rechts,
// typografischer Macro-Stat-Ribbon, Mikronaehrstoffe als vertikale
// Bar-List, QR-Stempel-Card im Footer.
//
// Mirrors AmberPage in lib/pdf/recipe-card-pdf.tsx — gleicher Look,
// gleiches Halo-Pattern, gleiche Mikro-Bar-Visualisierung.
// ════════════════════════════════════════════════
function AmberLayout({
  brand,
  pack,
  recipe,
  totalRecipes,
  enriching,
}: RecipeCardFullProps) {
  const totalTime = recipe.prepTime + (recipe.cookTime ?? 0);
  const portionsLbl = recipe.servings === 1 ? "Portion" : "Portionen";
  const grouped = groupIngredients(recipe.ingredients);
  const stepsArr = recipe.steps ?? [];
  const normSteps = stepsArr.map((s) =>
    typeof s === "string" ? { text: s, group: undefined as string | undefined } : s
  );
  const micros = (recipe.nutrition.micros ?? []).slice(0, 6);
  const stats = [
    { value: String(recipe.nutrition.kcal), label: "kcal" },
    { value: `${recipe.nutrition.protein}g`, label: "Eiweiß" },
    { value: `${recipe.nutrition.carbs}g`, label: "Kohlenh." },
    { value: `${recipe.nutrition.fat}g`, label: "Fett" },
  ];

  return (
    <div className="mx-auto w-full max-w-[940px]">
      {/* TOP STRIP — nur Pack-Info, kein Recipe-Index (Single-Detail-Page,
          siehe lib/pdf/recipe-pdf.tsx hideRecipeIndex) */}
      <div
        className="flex items-center px-2 pb-3 text-[10.5px] font-semibold uppercase tracking-[0.22em]"
        style={{ color: pack.mood.inkSoft }}
      >
        <span>
          Pack {String(pack.number).padStart(2, "0")} · {pack.title}
        </span>
      </div>

      {/* HERO mit HONEY-HALO + AVATAR-STEMPEL */}
      <div className="relative flex flex-col items-center pb-5 pt-6">
        {/* Halo */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 mx-auto"
          style={{
            background: `radial-gradient(ellipse 60% 70% at 50% 45%, ${pack.mood.accent}38, transparent 65%)`,
          }}
        />

        {/* Hero centered */}
        <div
          className="relative aspect-[16/10] w-full max-w-[480px] overflow-hidden rounded-3xl border"
          style={{
            borderColor: pack.mood.accent + "55",
            boxShadow: `0 20px 50px -25px ${pack.mood.accent}66, 0 1px 0 ${pack.mood.accent}33`,
          }}
        >
          {enriching?.hero ? (
            <HeroSkeleton pack={pack} />
          ) : (
            <Image
              src={recipe.hero ?? pack.coverImage}
              alt={recipe.title}
              fill
              sizes="(min-width: 1024px) 480px, 100vw"
              className="object-cover content-fade-in"
              priority
              quality={95}
/>
          )}

          {/* Avatar-Stempel oben rechts auf dem Hero */}
          <div
            className="absolute right-4 top-4 size-[64px] overflow-hidden rounded-full border-[3px] p-[3px]"
            style={{
              borderColor: pack.mood.accent,
              background: "white",
              boxShadow: `0 6px 14px -4px ${pack.mood.ink}55`,
            }}
          >
            <div className="size-full overflow-hidden rounded-full">
              <Image
                src={brand.avatar}
                alt={brand.name}
                width={56}
                height={56}
                className="size-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>

      {/* TITLE-BLOCK */}
      <div className="flex flex-col items-center px-4 pb-6 text-center">
        <span
          className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.26em]"
          style={{ color: pack.mood.accent }}
        >
          {pack.category}
        </span>
        <h1
          className="font-display text-[40px] italic leading-[0.96] tracking-[-0.01em] sm:text-[54px]"
          style={{ color: pack.mood.ink }}
        >
          {recipe.title}
        </h1>
        {recipe.subtitle ? (
          <p
            className="mt-2 font-display text-[16px] italic leading-snug"
            style={{ color: pack.mood.inkSoft }}
          >
            «&nbsp;{recipe.subtitle}&nbsp;»
          </p>
        ) : null}
        <p
          className="mt-2 text-[12.5px]"
          style={{ color: pack.mood.inkSoft, letterSpacing: "0.04em" }}
        >
          {totalTime} Min · {recipe.difficulty} · {recipe.servings}× {portionsLbl}
        </p>
      </div>

      {/* STAT-RIBBON — typografisch, ohne Boxes */}
      <div
        className="flex flex-wrap items-baseline justify-center gap-x-6 gap-y-2 border-y py-4"
        style={{
          borderColor: pack.mood.accent + "55",
        }}
      >
        {stats.map((s, i) => (
          <div key={s.label} className="flex items-baseline gap-1.5">
            <span
              className="font-display text-[28px] leading-none sm:text-[34px]"
              style={{ color: pack.mood.ink }}
            >
              {enriching?.micros && s.label === "kcal" ? "—" : s.value}
            </span>
            <span
              className="text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{ color: pack.mood.inkSoft }}
            >
              {s.label}
            </span>
            {i < stats.length - 1 ? (
              <span
                aria-hidden
                className="ml-3 text-[14px]"
                style={{ color: pack.mood.accent }}
              >
                ·
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {/* BIENES STORY — Honey-tinted Pull-Quote, sitzt zwischen Stat-
          Ribbon und Body. Bei kurzen Feierabend-Klassikern (z. B. der
          Cloud-Wrap-Variante) waere die Karte sonst unter dem grosszuegigen
          Hero halbleer. Schwelle und Look matchen das gemeinsame Web-
          Helper-Pattern (≤10 Zutaten). */}
      {webShouldShowStory(recipe) ? (
        <div
          className="border-y px-2 py-6 text-center"
          style={{
            borderColor: pack.mood.accent + "55",
            background: pack.mood.accent + "12",
          }}
        >
          <span
            className="mb-2 block text-[10.5px] font-bold uppercase tracking-[0.26em]"
            style={{ color: pack.mood.accent }}
          >
            Story
          </span>
          <p
            className="mx-auto max-w-[60ch] font-display text-[17px] italic leading-relaxed"
            style={{ color: pack.mood.ink }}
          >
            {recipe.description}
          </p>
        </div>
      ) : null}

      {/* BODY — 2-Spalten */}
      <div className="grid grid-cols-1 gap-7 px-2 py-7 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
        {/* ZUTATEN */}
        <div
          className="lg:border-r lg:pr-7"
          style={{ borderColor: pack.mood.accent + "33" }}
        >
          <div
            className="mb-4 text-[10.5px] font-bold uppercase tracking-[0.22em]"
            style={{ color: pack.mood.accent }}
          >
            Zutaten · {recipe.ingredients.length} Items
          </div>
          <div className="flex flex-col">
            {grouped.map((group, gi) => (
              <div key={gi} className={gi < grouped.length - 1 ? "mb-4" : ""}>
                {group.name ? (
                  <div
                    className="mb-1.5 font-display text-[14px] italic"
                    style={{ color: pack.mood.inkSoft }}
                  >
                    {group.name}
                  </div>
                ) : null}
                {group.items.map((ing, ii) => (
                  <div
                    key={ii}
                    className="flex gap-3 border-b py-2 last:border-b-0"
                    style={{ borderColor: pack.mood.accent + "26" }}
                  >
                    <span
                      className="w-14 shrink-0 text-[12.5px] font-semibold"
                      style={{ color: pack.mood.accent }}
                    >
                      {ing.amount || "n. A."}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span
                        className="text-[13px] leading-snug"
                        style={{ color: pack.mood.ink }}
                      >
                        {ing.name}
                      </span>
                      {ing.note ? (
                        <span
                          className="mt-0.5 text-[11px] italic leading-snug"
                          style={{ color: pack.mood.inkSoft }}
                        >
                          {ing.note}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ZUBEREITUNG */}
        <div>
          <div
            className="mb-4 text-[10.5px] font-bold uppercase tracking-[0.22em]"
            style={{ color: pack.mood.accent }}
          >
            Zubereitung · {normSteps.length} Schritte · {totalTime} Min
          </div>
          <ol className="flex flex-col gap-3.5">
            {normSteps.map((step, si) => (
              <li key={si} className="flex gap-3">
                <span
                  className="w-7 shrink-0 pt-0.5 font-display text-[20px] leading-none"
                  style={{ color: pack.mood.accent }}
                >
                  {String(si + 1).padStart(2, "0")}
                </span>
                <span
                  className="flex-1 text-[13px] leading-relaxed"
                  style={{ color: pack.mood.ink }}
                >
                  {step.text}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* MIKROS — vertikale Bar-List */}
      {micros.length > 0 || enriching?.micros ? (
        <div
          className="border-t px-2 py-5"
          style={{ borderColor: pack.mood.accent + "55" }}
        >
          <div
            className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.22em]"
            style={{ color: pack.mood.accent }}
          >
            Nährstoff-Profil ·{" "}
            {recipe.nutritionBasis === "piece"
              ? "pro Stück"
              : recipe.nutritionBasis === "per100g"
                ? "pro 100 g"
                : recipe.nutritionBasis === "total"
                  ? "gesamt"
                  : "pro Portion"}
          </div>
          {enriching?.micros ? (
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-6 animate-pulse rounded"
                  style={{
                    background: pack.mood.accent + "20",
                    animationDelay: `${i * 80}ms`,
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-7 gap-y-1.5 lg:grid-cols-2">
              {micros.map((m) => (
                <AmberMicroBarWeb key={m.name} micro={m} pack={pack} />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* FOOTER — Brand-Signatur + QR-Stempel-Card */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-t px-2 pt-5"
        style={{ borderColor: pack.mood.accent + "33" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="size-9 overflow-hidden rounded-full border-2 p-[2px]"
            style={{ borderColor: pack.mood.accent, background: "white" }}
          >
            <div className="size-full overflow-hidden rounded-full">
              <Image
                src={brand.avatar}
                alt={brand.name}
                width={32}
                height={32}
                className="size-full object-cover"
              />
            </div>
          </div>
          <div className="flex flex-col leading-tight">
            <span
              className="inline-flex items-center gap-1.5 font-display text-[16px] italic"
              style={{ color: pack.mood.ink }}
            >
              {brand.signature}
              <BeeIcon brandSlug={brand.slug} size={17} />
            </span>
            <span
              className="text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ color: pack.mood.inkSoft }}
            >
              {brand.handle} · {pack.title}
            </span>
          </div>
        </div>
        {recipe.sourceUrl ? (
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-opacity hover:opacity-80"
            style={{
              borderColor: pack.mood.accent + "55",
              background: pack.mood.accent + "18",
              color: pack.mood.ink,
            }}
          >
            <span>Original-Reel</span>
            <span aria-hidden style={{ color: pack.mood.accent }}>
              →
            </span>
          </a>
        ) : null}
      </div>
    </div>
  );
}

function AmberMicroBarWeb({
  micro,
  pack,
}: {
  micro: { name: string; amount: string; pctDaily?: number };
  pack: Pack;
}) {
  const pct = Math.max(0, Math.min(100, micro.pctDaily ?? 0));
  return (
    <div className="flex items-center gap-2.5 py-1">
      <span
        className="w-20 shrink-0 truncate text-[11.5px] font-semibold"
        style={{ color: pack.mood.ink }}
      >
        {micro.name}
      </span>
      <span
        className="w-14 shrink-0 text-[10.5px]"
        style={{ color: pack.mood.inkSoft }}
      >
        {micro.amount}
      </span>
      <div
        className="relative h-1.5 flex-1 overflow-hidden rounded-full"
        style={{ background: pack.mood.accent + "26" }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${pct}%`,
            background: pack.mood.accent,
          }}
        />
      </div>
      <span
        className="w-10 shrink-0 text-right text-[11px] font-bold tabular-nums"
        style={{ color: pack.mood.accent }}
      >
        {pct}%
      </span>
    </div>
  );
}


// ════════════════════════════════════════════════
// LAYOUT 5: DASHBOARD — Pack 5 (Meal-Prep, Sky Blue)
// Notion-Template: strukturiert, day-of-week tags,
// data-rows, checklist style
// ════════════════════════════════════════════════
function DashboardLayout({
  brand,
  pack,
  recipe,
  totalRecipes,
  enriching,
}: RecipeCardFullProps) {
  const totalTime = recipe.prepTime + (recipe.cookTime ?? 0);
  const portionsLabel = recipe.servings === 1 ? "Portion" : "Portionen";
  const weekDay = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"][
    (recipe.number - 1) % 7
  ];
  return (
    <article
      className="mx-auto w-full max-w-[860px] overflow-hidden rounded-[var(--radius-card)] border bg-white"
      style={baseShellStyle(pack, brand)}
    >
      {/* Notion-like header */}
      <div
        className="flex flex-wrap items-center gap-3 border-b px-8 py-4 text-[12px]"
        style={{ borderColor: brand.tokens.line, background: pack.mood.background + "40" }}
      >
        <span
          className="rounded-md px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{ background: pack.mood.background, color: pack.mood.ink }}
        >
          {weekDay}
        </span>
        <span style={{ color: pack.mood.inkSoft }}>{pack.title}</span>
        <span className="ml-auto" style={{ color: pack.mood.accent }}>
          ✓ Mealprep-Ready
        </span>
      </div>

      {/* Title + image strip */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-3 px-8 pt-10 pb-8">
          <h1
            className="font-display text-[40px] leading-[1.02] tracking-[-0.01em] sm:text-[48px]"
            style={{ color: pack.mood.ink }}
          >
            {recipe.title}
          </h1>
          <p
            className="text-[14px] leading-snug"
            style={{ color: pack.mood.inkSoft }}
          >
            {recipe.subtitle}
          </p>

          {/* Notion-style data rows — Pro-Portion explizit */}
          <div
            className="mt-4 flex flex-col gap-px overflow-hidden rounded-lg border"
            style={{ borderColor: brand.tokens.line }}
          >
            <DashRow
              icon="🍴"
              label="Ergibt"
              value={`${recipe.servings} ${portionsLabel}`}
              pack={pack}
            />
            <DashRow
              icon="🔥"
              label={nutritionBasisLabelShort(recipe.nutritionBasis)}
              value={`${recipe.nutrition.kcal} kcal`}
              pack={pack}
              highlight
            />
            <DashRow
              icon="💪"
              label={`Eiweiß / ${nutritionBasisLabelShort(recipe.nutritionBasis).replace(/^Pro /, "")}`}
              value={`${recipe.nutrition.protein} g`}
              pack={pack}
            />
            <DashRow
              icon="⏱"
              label="Zubereitung"
              value={`${totalTime} Min`}
              pack={pack}
            />
            <DashRow
              icon="📊"
              label="Schwierigkeit"
              value={recipe.difficulty}
              pack={pack}
            />
          </div>
        </div>

        <div className="relative h-full min-h-[280px] lg:min-h-0">
          {enriching?.hero ? (
            <HeroSkeleton pack={pack} />
          ) : (
            <>
              <Image
                src={recipe.hero ?? pack.coverImage}
                alt={recipe.title}
                fill
                sizes="(min-width: 1024px) 360px, 100vw"
                className="object-cover content-fade-in"
                priority
                quality={95}
/>
              <div
                className="absolute inset-0 mix-blend-multiply"
                style={{ background: pack.mood.background, opacity: 0.18 }}
              />
            </>
          )}
        </div>
      </div>

      {/* BIENES STORY — sage-tinted Pull-Quote zwischen Header-Tile und
          Checklist-Body, matche das Dashboard-PDF (recipe-card-pdf.tsx
          Zeile 2828). Bei kurzen Mealprep-Karten (Eisbowl-Stil) sonst
          fühlt sich der Rest der Page leer an. */}
      {webShouldShowStory(recipe) ? (
        <WebStoryBlock
          recipe={recipe}
          pack={pack}
          className="border-t px-8 py-6"
        />
      ) : null}

      {/* Body as checklist */}
      <div
        className="grid grid-cols-1 gap-10 border-t px-8 pt-10 pb-10 lg:grid-cols-[1fr_1.4fr] lg:gap-14"
        style={{ borderColor: brand.tokens.line }}
      >
        <SectionList
          recipe={recipe}
          pack={pack}
          kind="ingredients"
          checklist
        />
        <SectionList recipe={recipe} pack={pack} kind="steps" checklist />
      </div>

      <CardFooter brand={brand} pack={pack} recipe={recipe} enriching={enriching} />
    </article>
  );
}

function DashRow({
  icon,
  label,
  value,
  pack,
  highlight = false,
}: {
  icon: string;
  label: string;
  value: string;
  pack: Pack;
  highlight?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 px-3 py-2 ${
        highlight ? "text-[14px]" : "text-[13px]"
      }`}
      style={{
        background: highlight
          ? pack.mood.background + "70"
          : "rgba(255,255,255,0.6)",
      }}
    >
      <span className="text-base">{icon}</span>
      <span
        style={{
          color: highlight ? pack.mood.ink : pack.mood.inkSoft,
          fontWeight: highlight ? 600 : 400,
        }}
      >
        {label}
      </span>
      <span
        className={`font-mono tabular-nums ${
          highlight ? "text-[14px] font-bold" : "text-[12px] font-semibold"
        }`}
        style={{ color: pack.mood.ink }}
      >
        {value}
      </span>
    </div>
  );
}

// ════════════════════════════════════════════════
// SHARED SUB-COMPONENTS
// ════════════════════════════════════════════════

function SectionList({
  recipe,
  pack,
  kind,
  headerStyle,
  minimal,
  bold,
  checklist,
  hideHeader,
  groupedOverride,
}: {
  recipe: Recipe;
  pack: Pack;
  kind: "ingredients" | "steps";
  headerStyle?: "italic";
  minimal?: boolean;
  bold?: boolean;
  checklist?: boolean;
  // When the parent layout already renders its own heading row (Patisserie
  // does — its heading sits in a flex row with a meta-label), skip the
  // default <h2> so we don't end up with the same title twice.
  hideHeader?: boolean;
  // Override the grouped-ingredient computation. Patisserie's parent
  // computes `grouped` once and passes it in to keep parent + child in
  // sync (e.g. when both branches need access to the same group order).
  // Other layouts can leave this undefined and SectionList groups itself.
  groupedOverride?: IngredientGroup[];
}) {
  const isIngredients = kind === "ingredients";
  const heading = isIngredients ? "Man nehme" : "Zubereitung";
  const ingredientGroups =
    groupedOverride ?? groupIngredients(recipe.ingredients);

  return (
    <div className="flex flex-col gap-4">
      {hideHeader ? null : (
        <h2
          className={`text-[12px] font-semibold uppercase tracking-[0.22em] ${
            headerStyle === "italic" ? "italic" : ""
          }`}
          style={{ color: pack.mood.accent }}
        >
          {heading}
        </h2>
      )}
      {isIngredients ? (
        <ul className="flex flex-col">
          {ingredientGroups.map((group, gIdx) => (
            <li key={`g-${gIdx}`} className="contents">
              {group.name ? (
                <li
                  className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${gIdx > 0 ? "mt-3" : ""} pb-1.5`}
                  style={{ color: pack.mood.accent }}
                >
                  {group.name}
                </li>
              ) : null}
              {group.items.map((ingredient, idx) => (
                <li
                  key={`${ingredient.name}-${gIdx}-${idx}`}
                  className={`grid grid-cols-[4.2rem_1fr] items-start gap-3 ${
                    minimal ? "py-2" : "border-b py-2.5"
                  }`}
                  style={{
                    borderColor: pack.mood.ink + "12",
                    color: pack.mood.ink,
                  }}
                >
                  <span
                    className={`font-mono text-[12px] tabular-nums break-words leading-snug ${
                      bold ? "font-semibold" : ""
                    }`}
                    style={{ color: pack.mood.inkSoft }}
                  >
                    {ingredient.amount}
                  </span>
                  <span
                    className={`text-[14px] leading-snug ${
                      bold ? "font-semibold" : ""
                    }`}
                  >
                    {checklist ? (
                      <span className="mr-2 opacity-50">☐</span>
                    ) : null}
                    {ingredient.name}
                    {ingredient.note ? (
                      <span
                        className="block text-[11px] italic"
                        style={{ color: pack.mood.inkSoft }}
                      >
                        {ingredient.note}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </li>
          ))}
        </ul>
      ) : (
        <ol className="flex flex-col gap-4">
          {groupRecipeSteps(recipe.steps).map((group, gIdx) => (
            <li key={`sg-${gIdx}`} className="contents">
              {group.name ? (
                <li
                  className="text-[11px] font-semibold uppercase tracking-[0.22em]"
                  style={{
                    color: pack.mood.accent,
                    paddingTop: gIdx > 0 ? "0.25rem" : 0,
                  }}
                >
                  {group.name}
                </li>
              ) : null}
              {group.items.map((item) => (
                <li
                  key={item.index}
                  className="grid grid-cols-[2.2rem_1fr] gap-3"
                >
                  <span
                    className={`font-display text-[28px] leading-none tabular-nums ${
                      bold ? "font-bold" : ""
                    }`}
                    style={{ color: pack.mood.accent }}
                  >
                    {item.index + 1}
                  </span>
                  <span
                    className="text-[15px] leading-[1.55]"
                    style={{ color: pack.mood.ink }}
                  >
                    {item.text}
                  </span>
                </li>
              ))}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function MacrosBlock({
  recipe,
  pack,
  variant,
  perPortionLabel,
}: {
  recipe: Recipe;
  pack: Pack;
  variant: "strip" | "pills" | "bold" | "hero";
  perPortionLabel?: string;
}) {
  // Default the label to whatever the recipe's nutrition basis is. Callers
  // may still override (legacy: editorial layout passed "pro Portion" as a
  // baked-in default before this field existed).
  const basisLabel =
    perPortionLabel ?? nutritionBasisInline(recipe.nutritionBasis);
  const items = [
    { label: "Eiweiß", value: `${recipe.nutrition.protein}g` },
    { label: "Kohlenhydrate", value: `${recipe.nutrition.carbs}g` },
    { label: "Fett", value: `${recipe.nutrition.fat}g` },
  ];

  if (variant === "hero") {
    const macroBars = [
      { label: "Eiweiß", value: recipe.nutrition.protein, max: 60, unit: "g" },
      { label: "Kohlenhydrate", value: recipe.nutrition.carbs, max: 100, unit: "g" },
      { label: "Fett", value: recipe.nutrition.fat, max: 40, unit: "g" },
    ];
    if (recipe.nutrition.fiber !== undefined) {
      macroBars.push({ label: "Ballaststoffe", value: recipe.nutrition.fiber, max: 15, unit: "g" });
    }
    return (
      <div
        className="border-t border-b px-8 py-8 sm:px-12"
        style={{
          borderColor: pack.mood.ink + "20",
          background: pack.mood.background + "20",
        }}
      >
        <div className="mb-5 flex items-baseline justify-between gap-3">
          <h2
            className="text-[12px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: pack.mood.accent }}
          >
            Makronährstoffe
          </h2>
          <span
            className="text-[10px] font-medium uppercase tracking-[0.14em]"
            style={{ color: pack.mood.inkSoft }}
          >
            {basisLabel} ({recipe.nutrition.kcal} kcal)
          </span>
        </div>
        <div className="flex flex-col gap-3.5">
          {macroBars.map((m) => (
            <div
              key={m.label}
              className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-4"
            >
              <span
                className="text-[12px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: pack.mood.inkSoft }}
              >
                {m.label}
              </span>
              <div
                className="h-2 overflow-hidden rounded-full"
                style={{ background: pack.mood.ink + "12" }}
              >
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{
                    width: `${Math.min((m.value / m.max) * 100, 100)}%`,
                    background: pack.mood.accent,
                  }}
                />
              </div>
              <span
                className="text-right font-display text-[18px] tabular-nums"
                style={{ color: pack.mood.ink }}
              >
                {m.value}
                {m.unit}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "pills") {
    return (
      <div
        className="flex flex-wrap items-center justify-center gap-3 border-t border-b px-8 py-5"
        style={{ borderColor: pack.mood.ink + "20" }}
      >
        <span
          className="inline-flex items-baseline gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold tabular-nums"
          style={{ background: pack.mood.ink, color: pack.mood.background }}
        >
          {recipe.nutrition.kcal} kcal
          <span className="text-[10px] font-normal italic opacity-80">
            {basisLabel}
          </span>
        </span>
        {items.map((item) => (
          <span
            key={item.label}
            className="text-[13px]"
            style={{ color: pack.mood.inkSoft }}
          >
            <span
              className="font-display text-[16px] tabular-nums"
              style={{ color: pack.mood.ink }}
            >
              {item.value}
            </span>{" "}
            {item.label}
          </span>
        ))}
      </div>
    );
  }
  if (variant === "bold") {
    return (
      <div
        className="grid grid-cols-3 divide-x"
        style={{
          background: pack.mood.background,
          borderColor: pack.mood.ink + "20",
        }}
      >
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-baseline justify-center gap-2 py-5"
            style={{ borderColor: pack.mood.ink + "20" }}
          >
            <span
              className="font-sans text-[26px] font-bold tabular-nums"
              style={{ color: pack.mood.ink }}
            >
              {item.value}
            </span>
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: pack.mood.inkSoft }}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    );
  }
  // strip variant (editorial)
  return (
    <div
      className="grid grid-cols-4 border-t border-b"
      style={{ borderColor: pack.mood.ink + "20" }}
    >
      <MacroCell
        label="Kalorien"
        value={String(recipe.nutrition.kcal)}
        unit="kcal"
        highlight
        pack={pack}
      />
      {items.map((item) => (
        <MacroCell
          key={item.label}
          label={item.label}
          value={item.value}
          pack={pack}
        />
      ))}
    </div>
  );
}

function MacroCell({
  label,
  value,
  unit,
  pack,
  highlight = false,
}: {
  label: string;
  value: string;
  unit?: string;
  pack: Pack;
  highlight?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center gap-1 border-r py-5"
      style={{
        borderColor: pack.mood.ink + "20",
        background: highlight ? pack.mood.background + "60" : "transparent",
      }}
    >
      <span
        className="flex items-baseline gap-1 font-display tabular-nums"
        style={{ color: pack.mood.ink }}
      >
        <span className="text-[28px] leading-none">{value}</span>
        {unit ? (
          <span className="text-[11px]" style={{ color: pack.mood.inkSoft }}>
            {unit}
          </span>
        ) : null}
      </span>
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: pack.mood.inkSoft }}
      >
        {label}
      </span>
    </div>
  );
}

function CardFooter({
  brand,
  pack,
  recipe,
  italic = false,
  hideMicros = false,
  enriching,
}: {
  brand: Brand;
  pack: Pack;
  recipe?: Recipe;
  italic?: boolean;
  // Pack 5 (Editorial) renders the micros banner at the top instead of in
  // the footer — set this to skip the default MicrosPanel rendering.
  hideMicros?: boolean;
  enriching?: EnrichingState;
}) {
  return (
    <>
      {hideMicros
        ? null
        : enriching?.micros
        ? <MicrosSkeletonStrip pack={pack} />
        : <MicrosPanel recipe={recipe} pack={pack} />}
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-t px-8 py-4 sm:px-10"
        style={{
          borderColor: brand.tokens.line,
          background: brand.tokens.surface,
        }}
      >
        <span
          className={`inline-flex items-center gap-1.5 font-display text-[20px] ${italic ? "italic" : ""}`}
          style={{ color: brand.tokens.ink }}
        >
          {brand.signature}
          <BeeIcon brandSlug={brand.slug} size={22} />
        </span>

      <div className="flex flex-wrap items-center gap-3">
        {recipe?.sourceUrl ? (
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-opacity hover:opacity-80"
            style={{
              borderColor: brand.tokens.line,
              color: brand.tokens.inkMuted,
              background: brand.tokens.background,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
            </svg>
            {recipe.sourceLabel ?? "Original-Reel ansehen"}
          </a>
        ) : null}
        <span
          className="text-[11px] font-medium uppercase tracking-[0.16em]"
          style={{ color: brand.tokens.inkMuted }}
        >
          {brand.handle} · {pack.title}
        </span>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════
// MICROS — same compact strip across all 5 layouts.
// "REICH AN" header + top micros as inline pills sorted by % EU-NRV.
// Pack-themed accent. Hides itself if the recipe has no micros yet.
// ════════════════════════════════════════════════
function MicrosPanel({
  recipe,
  pack,
}: {
  recipe?: Recipe;
  pack: Pack;
}) {
  const micros = recipe?.nutrition?.micros;
  if (!micros || micros.length === 0) return null;

  // Show all that AI returned (already capped at ~10), sorted desc by %TBD
  const sorted = [...micros].sort(
    (a, b) => (b.pctDaily ?? 0) - (a.pctDaily ?? 0)
  );

  return (
    <div
      className="border-t px-8 py-5 sm:px-10"
      style={{
        borderColor: pack.mood.ink + "20",
        background: pack.mood.background + "26",
      }}
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3
          className="text-[12px] font-semibold uppercase tracking-[0.22em]"
          style={{ color: pack.mood.accent }}
        >
          Reich an
        </h3>
        <span
          className="text-[10px] font-medium uppercase tracking-[0.14em]"
          style={{ color: pack.mood.inkSoft }}
        >
          Mikronährstoffe {nutritionBasisInline(recipe.nutritionBasis)} · % Tagesbedarf
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {sorted.map((m) => (
          <div
            key={m.name}
            className="inline-flex items-baseline gap-2 rounded-full border px-3 py-1.5"
            style={{
              borderColor: pack.mood.ink + "1f",
              background: "rgba(255,255,255,0.55)",
            }}
          >
            <span
              className="text-[12px] font-medium"
              style={{ color: pack.mood.ink }}
            >
              {m.name}
            </span>
            <span
              className="text-[10px] tabular-nums"
              style={{ color: pack.mood.inkSoft }}
            >
              {m.amount}
            </span>
            {m.pctDaily ? (
              <span
                className="rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums"
                style={{
                  background: pack.mood.accent,
                  color: pack.mood.background,
                }}
              >
                {m.pctDaily}%
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// VINYL — 12"-Schallplatte (Phase C, neu)
// ════════════════════════════════════════════════
function VinylLayout({
  brand,
  pack,
  recipe,
  totalRecipes,
}: RecipeCardFullProps) {
  const recipeIndex = recipe.number - 1;
  const grouped = groupIngredients(recipe.ingredients);
  const flatIngredients = grouped.flatMap((g) => g.items);
  const halfIngs = Math.ceil(flatIngredients.length / 2);

  const time = recipe.prepTime + (recipe.cookTime ?? 0);
  const audioKey = vinylAudioKeyWeb(recipe);
  const topMicros = (recipe.nutrition.micros ?? [])
    .slice()
    .sort((a, b) => (b.pctDaily ?? 0) - (a.pctDaily ?? 0))
    .slice(0, 3);

  const stepGroups = groupRecipeSteps(recipe.steps);
  const flatSteps: { label: string; text: string }[] = [];
  let runningIdx = 0;
  for (const g of stepGroups) {
    for (const item of g.items) {
      const half = Math.ceil(recipe.steps.length / 2);
      const sidePrefix = runningIdx < half ? "A" : "B";
      const sideIdx =
        sidePrefix === "A" ? runningIdx + 1 : runningIdx - half + 1;
      flatSteps.push({ label: `${sidePrefix}${sideIdx}`, text: item.text });
      runningIdx += 1;
    }
  }
  const sideASize = Math.ceil(flatSteps.length / 2);
  const sideA = flatSteps.slice(0, sideASize);
  const sideB = flatSteps.slice(sideASize);

  const showStory =
    recipe.ingredients.length <= 10 && Boolean(recipe.description?.trim());

  // CSS Grooves: konzentrische Ringe per radial-gradient
  const groovesCss = `radial-gradient(circle at center,
    transparent 22%, #1a1a1a 22%, transparent 22.5%,
    transparent 28%, #181818 28%, transparent 28.5%,
    transparent 34%, #1a1a1a 34%, transparent 34.5%,
    transparent 40%, #181818 40%, transparent 40.5%,
    transparent 46%, #1a1a1a 46%, transparent 46.5%,
    transparent 50%)`;

  return (
    <article
      className="overflow-hidden rounded-[var(--radius-card)] border"
      style={{
        background: pack.mood.background,
        color: pack.mood.ink,
        ...baseShellStyle(pack, brand),
      }}
    >
      {/* ── Header ── */}
      <header
        className="flex items-center justify-between px-8 pt-7 pb-2"
        style={{ color: pack.mood.inkSoft }}
      >
        <span
          className="font-mono text-[11px] font-bold uppercase tracking-[0.2em]"
          style={{ color: pack.mood.accent }}
        >
          {pack.title}
        </span>
        <span
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em]"
        >
          {String(recipeIndex + 1).padStart(2, "0")} / {String(totalRecipes).padStart(2, "0")}
        </span>
      </header>

      {/* ── Album-Sleeve: Hero gross + LP halb-rausgezogen ── */}
      <section className="flex flex-col items-center px-8 pt-4 pb-2">
        <div
          className="relative"
          style={{
            width: "min(420px, 70%)",
            aspectRatio: "1.55 / 1",
          }}
        >
          {/* LP-Disc rechts (1:1, hinter Hero links überlappt) */}
          <div
            className="absolute rounded-full shadow-2xl"
            style={{
              top: 0,
              right: 0,
              width: "65%",
              aspectRatio: "1 / 1",
              background: `${groovesCss}, #0a0a0a`,
            }}
          >
            {/* Center Label */}
            <div
              className="absolute rounded-full"
              style={{
                inset: "33%",
                background: pack.mood.accent,
                color: "#fafafa",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "8px",
              }}
            >
              <span
                className="font-display font-bold uppercase leading-[0.95]"
                style={{ fontSize: "calc(0.6vw + 8px)", letterSpacing: "0.02em" }}
              >
                {brand.name}
              </span>
              <span
                className="font-mono opacity-85"
                style={{
                  fontSize: "calc(0.3vw + 5px)",
                  letterSpacing: "0.14em",
                  marginTop: "4px",
                }}
              >
                {String(recipeIndex + 1).padStart(2, "0")} · SEITE A
              </span>
            </div>
            {/* Spindle hole */}
            <div
              className="absolute rounded-full bg-white"
              style={{
                top: "50%",
                left: "50%",
                width: "6px",
                height: "6px",
                transform: "translate(-50%, -50%)",
              }}
            />
          </div>

          {/* Album-Cover (Hero) LINKS, ueberlappt LP */}
          <div
            className="absolute overflow-hidden shadow-2xl"
            style={{
              top: 0,
              left: 0,
              width: "64%",
              aspectRatio: "1 / 1",
              borderRadius: "2px",
              background: pack.mood.background,
            }}
          >
            {recipe.hero ? (
              <Image
                src={recipe.hero}
                alt={recipe.title}
                fill
                sizes="280px"
                className="object-cover"
                quality={95}
                unoptimized={recipe.hero.startsWith("data:")}
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center font-display text-[80px] font-bold"
                style={{ color: pack.mood.accent, background: pack.mood.accent + "20" }}
              >
                {brand.name.charAt(0)}
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <h2
          className="mt-8 max-w-[480px] text-center font-display text-[34px] font-bold leading-[1.05] tracking-[-0.015em]"
          style={{ color: pack.mood.ink }}
        >
          {recipe.title}
        </h2>

        {/* Audio-Spec-Strip */}
        <div
          className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-4"
          style={{ color: pack.mood.inkSoft }}
        >
          <span
            className="font-mono text-[12px] font-bold uppercase tracking-[0.18em]"
            style={{ color: pack.mood.ink }}
          >
            {Math.round(recipe.nutrition.kcal)} KCAL
          </span>
          <span className="opacity-30">│</span>
          <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.18em]">
            {time} MIN
          </span>
          <span className="opacity-30">│</span>
          <span
            className="font-mono text-[12px] font-bold uppercase tracking-[0.18em]"
            style={{ color: pack.mood.accent }}
          >
            {audioKey}
          </span>
        </div>

        {topMicros.length > 0 ? (
          <div
            className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 opacity-90"
            style={{ color: pack.mood.inkSoft }}
          >
            {topMicros.map((m, i) => (
              <span
                key={`${m.name}-${i}`}
                className="flex items-baseline gap-1 font-mono text-[11px] uppercase tracking-[0.14em]"
              >
                <span
                  className="font-semibold"
                  style={{ color: pack.mood.accent }}
                >
                  {m.name}
                </span>
                {typeof m.pctDaily === "number" ? (
                  <span
                    className="font-bold"
                    style={{ color: pack.mood.ink }}
                  >
                    {m.pctDaily}%
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}
        <span
          className="mt-2 font-mono text-[9px] uppercase tracking-[0.18em] opacity-60"
        >
          {nutritionBasisInline(recipe.nutritionBasis)}
        </span>
      </section>

      {/* ── ZUTATEN ── */}
      <section className="px-8 pt-8">
        <div className="mb-2 flex items-center gap-2">
          <span
            className="font-mono text-[11px] font-bold uppercase tracking-[0.2em]"
            style={{ color: pack.mood.accent }}
          >
            Zutaten
          </span>
          <span
            className="h-[1px] flex-1"
            style={{ background: pack.mood.ink, opacity: 0.15 }}
          />
          <span
            className="font-mono text-[10px] uppercase tracking-[0.16em]"
            style={{ color: pack.mood.inkSoft }}
          >
            {recipe.ingredients.length} {recipe.ingredients.length === 1 ? "Zutat" : "Zutaten"}
          </span>
        </div>
        {grouped.length > 1 ? (
          <div className="flex flex-col gap-4">
            {grouped.map((group, gIdx) => (
              <div key={`g-${gIdx}`}>
                {group.name ? (
                  <h4
                    className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: pack.mood.inkSoft }}
                  >
                    {vinylWebGroupLabel(group.name)}
                  </h4>
                ) : null}
                <VinylIngredientGridWeb
                  items={group.items}
                  pack={pack}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            <div>
              {flatIngredients.slice(0, halfIngs).map((ing, i) => (
                <VinylIngredientRowWeb
                  key={`a-${i}`}
                  amount={ing.amount}
                  name={ing.name}
                  note={ing.note}
                  pack={pack}
                />
              ))}
            </div>
            <div>
              {flatIngredients.slice(halfIngs).map((ing, i) => (
                <VinylIngredientRowWeb
                  key={`b-${i}`}
                  amount={ing.amount}
                  name={ing.name}
                  note={ing.note}
                  pack={pack}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── ZUBEREITUNG (Tracklist) ── */}
      <section className="grid grid-cols-1 gap-6 px-8 pt-8 sm:grid-cols-2 sm:gap-10">
        <VinylSideColumnWeb sideLabel="Seite A" tracks={sideA} pack={pack} />
        {sideB.length > 0 ? (
          <VinylSideColumnWeb sideLabel="Seite B" tracks={sideB} pack={pack} />
        ) : (
          <div
            className="hidden opacity-40 sm:block"
            style={{ color: pack.mood.inkSoft }}
          >
            <div
              className="mb-2 flex items-center gap-2"
              style={{ color: pack.mood.accent }}
            >
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em]">
                Seite B
              </span>
              <span
                className="h-[1px] flex-1"
                style={{ background: pack.mood.ink, opacity: 0.15 }}
              />
            </div>
            <p className="font-mono text-[11px] italic">
              (Rezept passt komplett auf Seite A)
            </p>
          </div>
        )}
      </section>

      {/* ── Story-Block ── */}
      {showStory ? (
        <section className="mt-6 px-8">
          <blockquote
            className="border-l-2 pl-4 font-display text-[15px] italic leading-relaxed"
            style={{
              borderColor: pack.mood.accent,
              color: pack.mood.ink,
            }}
          >
            {recipe.description}
          </blockquote>
        </section>
      ) : null}

      {/* ── Footer ── */}
      <footer
        className="mt-8 flex items-center justify-between gap-4 border-t px-8 py-5"
        style={{
          borderColor: pack.mood.ink + "22",
          color: pack.mood.inkSoft,
        }}
      >
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <circle cx="8" cy="8" r="7.5" fill="#0a0a0a" />
            <circle cx="8" cy="8" r="2.5" fill={pack.mood.accent} />
            <circle cx="8" cy="8" r="0.8" fill="#fff" />
          </svg>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em]">
            {brand.handle} · {pack.title}
          </span>
        </div>
        {recipe.sourceUrl ? (
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] uppercase tracking-[0.18em] underline-offset-2 hover:underline"
            style={{ color: pack.mood.accent }}
          >
            {recipe.sourceLabel ?? "Original auf Instagram"} ↗
          </a>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">
            Vinyl-Edition
          </span>
        )}
      </footer>
    </article>
  );
}

function VinylSideColumnWeb({
  sideLabel,
  tracks,
  pack,
}: {
  sideLabel: string;
  tracks: { label: string; text: string }[];
  pack: Pack;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span
          className="font-mono text-[11px] font-bold uppercase tracking-[0.2em]"
          style={{ color: pack.mood.accent }}
        >
          {sideLabel}
        </span>
        <span
          className="h-[1px] flex-1"
          style={{ background: pack.mood.ink, opacity: 0.15 }}
        />
      </div>
      {tracks.map((t, i) => (
        <div
          key={`${sideLabel}-${i}`}
          className="mb-3 flex items-start gap-3 last:mb-0"
        >
          <span
            className="shrink-0 font-mono text-[13px] italic font-bold leading-[1.45] tabular-nums"
            style={{ color: pack.mood.accent, width: "26px" }}
          >
            {t.label}
          </span>
          <p
            className="text-[13px] leading-[1.45]"
            style={{ color: pack.mood.ink }}
          >
            {t.text}
          </p>
        </div>
      ))}
    </div>
  );
}

function VinylIngredientRowWeb({
  amount,
  name,
  note,
  pack,
}: {
  amount: string;
  name: string;
  note?: string;
  pack: Pack;
}) {
  const displayAmount =
    amount.length > 0
      ? amount.charAt(0).toUpperCase() + amount.slice(1)
      : amount;
  const amountIsLong = displayAmount.length > 10;
  return (
    <div
      className={`flex gap-3 border-b py-2 last:border-b-0 ${amountIsLong ? "items-center" : "items-start"}`}
      style={{ borderColor: pack.mood.ink + "14" }}
    >
      <span
        className="shrink-0 font-mono text-[12px] font-bold tabular-nums"
        style={{ color: pack.mood.accent, width: "76px" }}
      >
        {displayAmount}
      </span>
      <div className="flex-1">
        <p className="text-[13px] leading-snug" style={{ color: pack.mood.ink }}>
          {name}
        </p>
        {note ? (
          <p
            className="mt-0.5 text-[11px] italic"
            style={{ color: pack.mood.inkSoft }}
          >
            {note}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function VinylIngredientGridWeb({
  items,
  pack,
}: {
  items: { amount: string; name: string; note?: string }[];
  pack: Pack;
}) {
  if (items.length < 3) {
    return (
      <div>
        {items.map((ing, i) => (
          <VinylIngredientRowWeb
            key={`g-${i}`}
            amount={ing.amount}
            name={ing.name}
            note={ing.note}
            pack={pack}
          />
        ))}
      </div>
    );
  }
  const half = Math.ceil(items.length / 2);
  return (
    <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
      <div>
        {items.slice(0, half).map((ing, i) => (
          <VinylIngredientRowWeb
            key={`gha-${i}`}
            amount={ing.amount}
            name={ing.name}
            note={ing.note}
            pack={pack}
          />
        ))}
      </div>
      <div>
        {items.slice(half).map((ing, i) => (
          <VinylIngredientRowWeb
            key={`ghb-${i}`}
            amount={ing.amount}
            name={ing.name}
            note={ing.note}
            pack={pack}
          />
        ))}
      </div>
    </div>
  );
}

function vinylWebGroupLabel(name: string): string {
  return /^(den|die|das)\s/i.test(name)
    ? `Für ${name.toLowerCase()}`
    : name;
}

function vinylAudioKeyWeb(recipe: Recipe): string {
  const tags = (recipe.tags ?? []).map((t) => t.toLowerCase());
  if (tags.some((t) => t.includes("vegan"))) return "VEGAN";
  if (tags.some((t) => t.includes("high-protein") || t.includes("protein")))
    return "HIGH-PROTEIN";
  if (tags.some((t) => t.includes("low-carb"))) return "LOW-CARB";
  if (tags.some((t) => t.includes("vegetarisch"))) return "VEGETARISCH";
  if (tags.some((t) => t.includes("dessert") || t.includes("kuchen")))
    return "SÜSS";
  if (tags.some((t) => t.includes("snack"))) return "SNACK";
  if (tags.some((t) => t.includes("mealprep"))) return "MEALPREP";
  return "ORIGINAL";
}
