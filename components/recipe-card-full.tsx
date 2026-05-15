import Image from "next/image";
import { BeeIcon } from "./bee-icon";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import {
  normalizeStep,
  nutritionBasisLabel,
  nutritionBasisLabelShort,
  nutritionBasisInline,
  visibleMicros,
  type Recipe,
} from "@/lib/recipes";
import { formatIngredientAmount } from "@/lib/format-ingredient";
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
    case "newspaper":
      return <NewspaperLayout {...props} />;
    case "restaurant":
      return <RestaurantLayout {...props} />;
    case "studio":
      return <StudioLayout {...props} />;
  }
}

// Mirror of lib/pdf/recipe-card-pdf.tsx#getDensity, but without the
// recipe.tweaks.densityOverride read — that's a server-side concern we don't
// surface on the web preview (the preview is for layout-picking, not for
// per-recipe fine-tuning). Same scoring formula, same thresholds.
type WebDensity = "compact" | "balanced" | "spacious";
function webGetDensity(recipe: Recipe): WebDensity {
  if (recipe.tweaks?.densityOverride) return recipe.tweaks.densityOverride;
  const score = recipe.ingredients.length + recipe.steps.length * 1.5;
  if (score >= 22) return "compact";
  if (score <= 14) return "spacious";
  return "balanced";
}

// Title-Auto-Shrink (mirror of studioTitleScale in the PDF renderer). Long
// recipe titles otherwise blow out the left header column and wrap into 4+
// lines. Multiplier ranges 0.66 – 1.0.
function studioWebTitleScale(title: string): number {
  const len = title.length;
  if (len <= 18) return 1;
  if (len <= 30) return 0.88;
  if (len <= 45) return 0.76;
  return 0.66;
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
                          {formatIngredientAmount(ing.amount)}
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
  const micros = visibleMicros(recipe);
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
                  {formatIngredientAmount(ing.amount)}
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
  const micros = visibleMicros(recipe).slice(0, 8);

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
                        {formatIngredientAmount(ing.amount) || "Nach Geschmack"}
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
  const micros = visibleMicros(recipe).slice(0, 6);
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
                    {formatIngredientAmount(ingredient.amount)}
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
// NEWSPAPER — Broadsheet-Editorial (Phase C, neu)
// ════════════════════════════════════════════════
function NewspaperLayout({
  brand,
  pack,
  recipe,
  totalRecipes,
}: RecipeCardFullProps) {
  const recipeIndex = recipe.number - 1;
  const grouped = groupIngredients(recipe.ingredients);
  const flatIngredients = grouped.flatMap((g) => g.items);
  const time = recipe.prepTime + (recipe.cookTime ?? 0);

  const stepGroups = groupRecipeSteps(recipe.steps);
  const flatSteps: { num: number; text: string }[] = [];
  let running = 0;
  for (const g of stepGroups) {
    for (const item of g.items) {
      running += 1;
      flatSteps.push({ num: running, text: item.text });
    }
  }
  const halfSteps = Math.ceil(flatSteps.length / 2);
  const stepsA = flatSteps.slice(0, halfSteps);
  const stepsB = flatSteps.slice(halfSteps);

  const topMicros = visibleMicros(recipe)
    .slice()
    .sort((a, b) => (b.pctDaily ?? 0) - (a.pctDaily ?? 0))
    .slice(0, 3);

  const leadText = recipe.description?.trim() ?? "";
  const leadFirstChar = leadText.charAt(0);
  const leadRest = leadText.slice(1);

  return (
    <article
      className="overflow-hidden rounded-[var(--radius-card)] border"
      style={{
        background: "#fafaf5",
        color: pack.mood.ink,
        ...baseShellStyle(pack, brand),
      }}
    >
      {/* ── Masthead ── */}
      <header className="px-8 pt-7 pb-1">
        <div
          className="flex items-baseline justify-between gap-3 border-b-[2px] pb-2"
          style={{ borderColor: pack.mood.ink }}
        >
          <h1
            className="font-display text-[24px] font-bold italic leading-none"
            style={{ color: pack.mood.ink, letterSpacing: "-0.01em" }}
          >
            {brand.name} Times
          </h1>
          <span
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: pack.mood.inkSoft }}
          >
            Das Rezept-Magazin · {pack.title} · No {String(recipeIndex + 1).padStart(2, "0")} / {String(totalRecipes).padStart(2, "0")}
          </span>
        </div>
        <div
          className="mt-[2px] h-[1px]"
          style={{ background: pack.mood.ink }}
        />
      </header>

      {/* ── Hero + Headline + Lead ── */}
      <section className="grid gap-6 px-8 pt-5 md:grid-cols-[1.2fr_1fr]">
        <div>
          <div
            className="overflow-hidden"
            style={{
              aspectRatio: "4 / 3",
              background: pack.mood.background,
            }}
          >
            {recipe.hero ? (
              <Image
                src={recipe.hero}
                alt={recipe.title}
                width={640}
                height={480}
                className="h-full w-full object-cover"
                quality={95}
                unoptimized={recipe.hero.startsWith("data:")}
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center font-display text-[64px] font-bold italic"
                style={{ color: "#fafafa", background: pack.mood.accent }}
              >
                {brand.name.charAt(0)}
              </div>
            )}
          </div>
          <p
            className="mt-2 font-display text-[11px] italic leading-snug"
            style={{ color: pack.mood.inkSoft }}
          >
            {recipe.subtitle ||
              `Eine Aufnahme aus ${brand.name}s Küche, exklusiv für dieses Pack.`}
          </p>
        </div>

        <div>
          <p
            className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.2em]"
            style={{ color: pack.mood.accent }}
          >
            {pack.category}
          </p>
          <h2
            className="font-display text-[34px] font-bold italic leading-[1.05] tracking-[-0.01em]"
            style={{ color: pack.mood.ink }}
          >
            {recipe.title}
          </h2>
          <div className="mt-3 mb-3 flex items-center gap-2">
            <span
              className="font-display text-[13px] italic"
              style={{ color: pack.mood.inkSoft }}
            >
              Von {brand.name}
            </span>
            <span
              className="h-[1px] flex-1"
              style={{ background: pack.mood.ink, opacity: 0.18 }}
            />
            <span
              className="font-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ color: pack.mood.inkSoft }}
            >
              {time} Min
            </span>
          </div>
          {leadText.length > 0 ? (
            <div className="flex items-start gap-1">
              <span
                className="font-display text-[42px] font-bold italic leading-[0.85]"
                style={{ color: pack.mood.accent }}
              >
                {leadFirstChar}
              </span>
              <p
                className="flex-1 font-display text-[14px] leading-[1.5] text-justify"
                style={{ color: pack.mood.ink }}
              >
                {leadRest}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {/* ── Zutaten in 3 Spalten ── */}
      <section className="px-8 pt-8">
        <NewspaperSectionHeaderWeb
          label="Zutaten"
          right={`${recipe.ingredients.length} ${recipe.ingredients.length === 1 ? "Zutat" : "Zutaten"}`}
          pack={pack}
        />
        {grouped.length > 1 ? (
          <div className="flex flex-col gap-4 mt-2">
            {grouped.map((group, gIdx) => (
              <div key={`g-${gIdx}`}>
                {group.name ? (
                  <h4
                    className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: pack.mood.inkSoft }}
                  >
                    {newspaperGroupLabelWeb(group.name)}
                  </h4>
                ) : null}
                <NewspaperIngredientGridWeb
                  items={group.items}
                  pack={pack}
                />
              </div>
            ))}
          </div>
        ) : (
          <NewspaperIngredientGridWeb items={flatIngredients} pack={pack} />
        )}
      </section>

      {/* ── Zubereitung in 2 Spalten ── */}
      <section className="px-8 pt-7">
        <NewspaperSectionHeaderWeb
          label="Zubereitung"
          right={`${flatSteps.length} ${flatSteps.length === 1 ? "Schritt" : "Schritte"}`}
          pack={pack}
        />
        <div className="mt-2 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <NewspaperStepColumnWeb steps={stepsA} pack={pack} />
          {stepsB.length > 0 ? (
            <NewspaperStepColumnWeb steps={stepsB} pack={pack} />
          ) : null}
        </div>
      </section>

      {/* ── Spreadsheet-Footer mit Nährwerten + Mikros ── */}
      <section className="mt-8 px-8">
        <div
          className="h-[2px]"
          style={{ background: pack.mood.ink }}
        />
        <div
          className="mt-[2px] h-[1px]"
          style={{ background: pack.mood.ink, opacity: 0.5 }}
        />
        <p
          className="mt-3 mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ color: pack.mood.ink }}
        >
          Nährwerte {nutritionBasisInline(recipe.nutritionBasis)}
        </p>
        <div className="flex flex-wrap gap-x-8 gap-y-4 md:flex-nowrap">
          <div className="flex flex-1 flex-wrap gap-x-6 gap-y-3 md:flex-nowrap">
            <NewspaperMacroCellWeb label="KCAL" value={String(Math.round(recipe.nutrition.kcal))} pack={pack} />
            <NewspaperMacroCellWeb label="Protein" value={`${recipe.nutrition.protein}g`} pack={pack} />
            <NewspaperMacroCellWeb label="Kohlenh." value={`${recipe.nutrition.carbs}g`} pack={pack} />
            <NewspaperMacroCellWeb label="Fett" value={`${recipe.nutrition.fat}g`} pack={pack} />
          </div>
          {topMicros.length > 0 ? (
            <>
              <div
                className="hidden w-[1px] md:block"
                style={{ background: pack.mood.ink, opacity: 0.2 }}
              />
              <div className="flex flex-1 flex-wrap gap-x-5 gap-y-3 md:flex-nowrap">
                {topMicros.map((m, i) => (
                  <NewspaperMicroCellWeb
                    key={`${m.name}-${i}`}
                    name={m.name}
                    pct={m.pctDaily}
                    pack={pack}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="mt-8 flex items-center justify-between border-t px-8 py-5"
        style={{
          borderColor: pack.mood.ink + "22",
          color: pack.mood.inkSoft,
        }}
      >
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em]">
          {brand.handle} · {pack.title}
        </span>
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
            Erstausgabe
          </span>
        )}
      </footer>
    </article>
  );
}

// ─── Newspaper Sub-Components (Web) ──────────────────────────

function NewspaperSectionHeaderWeb({
  label,
  right,
  pack,
}: {
  label: string;
  right: string;
  pack: Pack;
}) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span
        className="font-mono text-[11px] font-bold uppercase tracking-[0.2em]"
        style={{ color: pack.mood.ink }}
      >
        {label}
      </span>
      <span
        className="h-[1px] flex-1"
        style={{ background: pack.mood.ink, opacity: 0.18 }}
      />
      <span
        className="font-mono text-[10px] uppercase tracking-[0.18em]"
        style={{ color: pack.mood.inkSoft }}
      >
        {right}
      </span>
    </div>
  );
}

function NewspaperIngredientGridWeb({
  items,
  pack,
}: {
  items: { amount: string; name: string; note?: string }[];
  pack: Pack;
}) {
  const useThree = items.length > 4;
  const cols = useThree ? 3 : 2;
  return (
    <div
      className={`grid gap-x-5 ${useThree ? "sm:grid-cols-3" : "sm:grid-cols-2"} grid-cols-1`}
    >
      {Array.from({ length: cols }).map((_, ci) => {
        const perCol = Math.ceil(items.length / cols);
        const colItems = items.slice(ci * perCol, (ci + 1) * perCol);
        return (
          <div key={`col-${ci}`}>
            {colItems.map((ing, i) => (
              <NewspaperIngredientRowWeb
                key={`${ci}-${i}`}
                amount={ing.amount}
                name={ing.name}
                note={ing.note}
                pack={pack}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function NewspaperIngredientRowWeb({
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
  const displayAmount = formatIngredientAmount(amount);
  const amountIsLong = displayAmount.length > 10;
  return (
    <div
      className={`flex gap-2 border-b py-2 last:border-b-0 ${amountIsLong ? "items-center" : "items-start"}`}
      style={{ borderColor: pack.mood.ink + "14" }}
    >
      <span
        className="shrink-0 font-mono text-[12px] font-bold tabular-nums"
        style={{ color: pack.mood.accent, width: "62px" }}
      >
        {displayAmount}
      </span>
      <div className="flex-1">
        <p
          className="font-display text-[13px] leading-snug"
          style={{ color: pack.mood.ink }}
        >
          {name}
        </p>
        {note ? (
          <p
            className="mt-0.5 font-display text-[11px] italic"
            style={{ color: pack.mood.inkSoft }}
          >
            {note}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function NewspaperStepColumnWeb({
  steps,
  pack,
}: {
  steps: { num: number; text: string }[];
  pack: Pack;
}) {
  return (
    <div>
      {steps.map((step) => (
        <div
          key={`s-${step.num}`}
          className="mb-3 flex items-start gap-2 last:mb-0"
        >
          <span
            className="shrink-0 font-mono text-[13px] italic font-bold leading-[1.45] tabular-nums"
            style={{ color: pack.mood.accent, width: "18px" }}
          >
            {step.num}
          </span>
          <p
            className="font-display text-[13px] leading-[1.45]"
            style={{ color: pack.mood.ink }}
          >
            {step.text}
          </p>
        </div>
      ))}
    </div>
  );
}

function NewspaperMacroCellWeb({
  label,
  value,
  pack,
}: {
  label: string;
  value: string;
  pack: Pack;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: pack.mood.inkSoft }}
      >
        {label}
      </span>
      <span
        className="font-display text-[20px] font-bold"
        style={{ color: pack.mood.ink }}
      >
        {value}
      </span>
    </div>
  );
}

function NewspaperMicroCellWeb({
  name,
  pct,
  pack,
}: {
  name: string;
  pct?: number;
  pack: Pack;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: pack.mood.accent }}
      >
        {name}
      </span>
      <span
        className="font-display text-[18px] font-bold"
        style={{ color: pack.mood.ink }}
      >
        {typeof pct === "number" ? `${pct}%` : "—"}
      </span>
    </div>
  );
}

function newspaperGroupLabelWeb(name: string): string {
  return /^(den|die|das)\s/i.test(name)
    ? `Für ${name.toLowerCase()}`
    : name;
}

// ════════════════════════════════════════════════
// RESTAURANT MENU — Fine-Dining Speisekarte (Phase C, neu)
// ════════════════════════════════════════════════
const RESTAURANT_WEB = {
  bg: "#fcf9f3",
  paper: "#f5f1e8",
  ink: "#2c2418",
  inkSoft: "#665544",
  inkSubtle: "#9a8a76",
  gold: "#b08842",
  goldSoft: "#d4b478",
  divider: "#d8cdb8",
} as const;

function toRomanWeb(n: number): string {
  const r: [number, string][] = [
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  let v = n;
  for (const [val, sym] of r) {
    while (v >= val) {
      out += sym;
      v -= val;
    }
  }
  return out;
}

function buildWineNotesWeb(
  micros: { name: string; pctDaily?: number }[],
  recipe: Recipe
): string {
  if (micros.length === 0) return "";
  const names = micros.map((m) => m.name);
  const microPart =
    names.length === 1
      ? `Reich an ${names[0]}`
      : names.length === 2
        ? `Reich an ${names[0]} und ${names[1]}`
        : `Reich an ${names.slice(0, -1).join(", ")} und ${names[names.length - 1]}`;
  const tags = (recipe.tags ?? []).map((t) => t.toLowerCase());
  let character: string;
  if (tags.some((t) => t.includes("dessert") || t.includes("süß") || t.includes("kuchen"))) {
    character = "süß und vollmundig wie ein edler Dessertwein";
  } else if (tags.some((t) => t.includes("protein") || t.includes("high-protein"))) {
    character = "kräftig und sättigend wie ein vollmundiger Roter";
  } else if (tags.some((t) => t.includes("vegan") || t.includes("salat") || t.includes("bowl"))) {
    character = "frisch und fokussiert wie ein leichter Sommerwein";
  } else if (tags.some((t) => t.includes("mealprep"))) {
    character = "ausgewogen und harmonisch wie ein klassischer Cuvée";
  } else if (tags.some((t) => t.includes("snack"))) {
    character = "spritzig und unkompliziert wie ein junger Schaumwein";
  } else {
    character = "ausgewogen und feinsinnig wie ein gut gereifter Jahrgang";
  }
  return `${microPart}, ${character}.`;
}

function RestaurantLayout({
  brand,
  pack,
  recipe,
  totalRecipes,
}: RecipeCardFullProps) {
  const recipeIndex = recipe.number - 1;
  const grouped = groupIngredients(recipe.ingredients);
  const flatIngredients = grouped.flatMap((g) => g.items);
  const time = recipe.prepTime + (recipe.cookTime ?? 0);

  const stepGroups = groupRecipeSteps(recipe.steps);
  const flatSteps: { num: number; text: string }[] = [];
  let running = 0;
  for (const g of stepGroups) {
    for (const item of g.items) {
      running += 1;
      flatSteps.push({ num: running, text: item.text });
    }
  }

  const topMicros = visibleMicros(recipe)
    .slice()
    .sort((a, b) => (b.pctDaily ?? 0) - (a.pctDaily ?? 0))
    .slice(0, 3);

  const wineNotes = buildWineNotesWeb(topMicros, recipe);
  const showStory =
    recipe.ingredients.length <= 10 && Boolean(recipe.description?.trim());

  return (
    <article
      className="overflow-hidden rounded-[var(--radius-card)] border"
      style={{
        background: RESTAURANT_WEB.bg,
        color: RESTAURANT_WEB.ink,
        borderColor: RESTAURANT_WEB.divider,
      }}
    >
      {/* ── Masthead ── */}
      <header className="flex flex-col items-center px-8 pt-8">
        <div className="flex w-full items-center gap-3">
          <span
            className="h-[1px] flex-1"
            style={{ background: RESTAURANT_WEB.gold }}
          />
          <span
            className="font-mono text-[10px] font-bold uppercase tracking-[0.3em]"
            style={{ color: RESTAURANT_WEB.gold }}
          >
            Le Menu
          </span>
          <span
            className="h-[1px] flex-1"
            style={{ background: RESTAURANT_WEB.gold }}
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span style={{ color: RESTAURANT_WEB.gold, fontSize: "9px" }}>◆</span>
          <span
            className="font-display text-[13px] italic font-semibold uppercase tracking-[0.2em]"
            style={{ color: RESTAURANT_WEB.ink }}
          >
            {brand.name}
          </span>
          <span style={{ color: RESTAURANT_WEB.gold, fontSize: "9px" }}>◆</span>
        </div>
        <p
          className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em]"
          style={{ color: RESTAURANT_WEB.inkSubtle }}
        >
          {pack.title}
          {`  ·  ${String(recipeIndex + 1).padStart(2, "0")} / ${String(totalRecipes).padStart(2, "0")}`}
        </p>
      </header>

      {/* ── Hero quadratisch mit Gold-Border ── */}
      <section className="flex justify-center px-8 pt-8">
        <div
          className="p-[5px]"
          style={{
            border: `1px solid ${RESTAURANT_WEB.gold}`,
          }}
        >
          <div
            className="relative h-[260px] w-[260px] overflow-hidden md:h-[300px] md:w-[300px]"
            style={{ background: RESTAURANT_WEB.paper }}
          >
            {recipe.hero ? (
              <Image
                src={recipe.hero}
                alt={recipe.title}
                fill
                sizes="300px"
                className="object-cover"
                quality={95}
                unoptimized={recipe.hero.startsWith("data:")}
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center font-display text-[100px] font-bold italic"
                style={{ background: pack.mood.accent, color: "#fafafa" }}
              >
                {brand.name.charAt(0)}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Title-Block ── */}
      <section className="flex flex-col items-center px-12 pt-7">
        <p
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.32em]"
          style={{ color: RESTAURANT_WEB.gold }}
        >
          {pack.category}
          {`  ·  ${toRomanWeb(recipeIndex + 1)}. Gang`}
        </p>
        <h2
          className="mt-3 max-w-[520px] text-center font-display text-[40px] italic font-semibold leading-[1.08]"
          style={{ color: RESTAURANT_WEB.ink, letterSpacing: "0.01em" }}
        >
          {recipe.title}
        </h2>
        {/* Ornamental Rule */}
        <div className="mt-3 flex items-center gap-2">
          <span
            className="block h-[1px] w-[50px]"
            style={{ background: RESTAURANT_WEB.gold }}
          />
          <span style={{ color: RESTAURANT_WEB.gold, fontSize: "9px" }}>◇</span>
          <span
            className="block h-[1px] w-[50px]"
            style={{ background: RESTAURANT_WEB.gold }}
          />
        </div>
        {recipe.subtitle ? (
          <p
            className="mt-3 max-w-[440px] text-center font-display text-[14px] italic leading-snug"
            style={{ color: RESTAURANT_WEB.inkSoft }}
          >
            {recipe.subtitle}
          </p>
        ) : null}
        <div
          className="mt-4 flex flex-wrap items-baseline justify-center gap-3"
          style={{ color: RESTAURANT_WEB.ink }}
        >
          <span className="font-mono text-[12px] font-bold uppercase tracking-[0.2em]">
            {time} Min
          </span>
          <span style={{ color: RESTAURANT_WEB.gold, fontSize: "9px" }}>·</span>
          <span className="font-mono text-[12px] font-bold uppercase tracking-[0.2em]">
            {Math.round(recipe.nutrition.kcal)} Kcal
          </span>
          <span style={{ color: RESTAURANT_WEB.gold, fontSize: "9px" }}>·</span>
          <span className="font-mono text-[12px] font-bold uppercase tracking-[0.2em]">
            {recipe.servings === 1 ? "1 Portion" : `${recipe.servings} Portionen`}
          </span>
        </div>
        {/* Sub-Spec-Strip mit den restlichen Makros — analog zum PDF. */}
        <div
          className="mt-2 flex flex-wrap items-baseline justify-center gap-2"
          style={{ color: RESTAURANT_WEB.inkSoft }}
        >
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">
            <span style={{ color: RESTAURANT_WEB.gold }}>Protein </span>
            {recipe.nutrition.protein}g
          </span>
          <span style={{ color: RESTAURANT_WEB.gold, fontSize: "8px" }}>·</span>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">
            <span style={{ color: RESTAURANT_WEB.gold }}>Kohlenh. </span>
            {recipe.nutrition.carbs}g
          </span>
          <span style={{ color: RESTAURANT_WEB.gold, fontSize: "8px" }}>·</span>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">
            <span style={{ color: RESTAURANT_WEB.gold }}>Fett </span>
            {recipe.nutrition.fat}g
          </span>
        </div>
      </section>

      {/* ── Zutaten mit Dot-Leader ── */}
      <section className="px-12 pt-10">
        <RestaurantSectionHeaderWeb
          label="Zutaten"
          right={`${recipe.ingredients.length} ${recipe.ingredients.length === 1 ? "Zutat" : "Zutaten"}`}
        />
        {grouped.length > 1 ? (
          <div className="flex flex-col gap-4">
            {grouped.map((group, gIdx) => (
              <div key={`g-${gIdx}`}>
                {group.name ? (
                  <h4
                    className="mb-1 font-display text-[11px] italic uppercase tracking-[0.16em]"
                    style={{ color: RESTAURANT_WEB.gold }}
                  >
                    {restaurantGroupLabelWeb(group.name)}
                  </h4>
                ) : null}
                {group.items.map((ing, i) => (
                  <RestaurantIngredientRowWeb
                    key={`gi-${gIdx}-${i}`}
                    amount={ing.amount}
                    name={ing.name}
                    note={ing.note}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div>
            {flatIngredients.map((ing, i) => (
              <RestaurantIngredientRowWeb
                key={`fi-${i}`}
                amount={ing.amount}
                name={ing.name}
                note={ing.note}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Zubereitung mit Roman-Numerals ── */}
      <section className="px-12 pt-8">
        <RestaurantSectionHeaderWeb
          label="Zubereitung"
          right={`${flatSteps.length} ${flatSteps.length === 1 ? "Schritt" : "Schritte"}`}
        />
        <div className="mt-3">
          {flatSteps.map((step) => (
            <div
              key={`s-${step.num}`}
              className="mb-3 flex items-start gap-2 last:mb-0"
            >
              {/* Roman-Numeral mit Glyph-Center-Lock §1: gleiche font-size + line-height */}
              <span
                className="shrink-0 font-display text-[14px] italic font-semibold leading-[1.55]"
                style={{
                  color: RESTAURANT_WEB.gold,
                  width: flatSteps.length >= 10 ? "44px" : "30px",
                }}
              >
                {toRomanWeb(step.num)}.
              </span>
              <p
                className="font-display text-[14px] leading-[1.55]"
                style={{ color: RESTAURANT_WEB.ink }}
              >
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Genussprofil (EIGENE Mikros-Position) ── */}
      {topMicros.length > 0 ? (
        <section className="px-12 pt-9">
          <div className="flex items-center gap-3 justify-center">
            <span
              className="h-[1px] flex-1"
              style={{ background: RESTAURANT_WEB.gold }}
            />
            <span style={{ color: RESTAURANT_WEB.gold, fontSize: "9px" }}>◇</span>
            <span
              className="font-mono text-[10px] font-bold uppercase tracking-[0.32em]"
              style={{ color: RESTAURANT_WEB.gold }}
            >
              Genussprofil
            </span>
            <span style={{ color: RESTAURANT_WEB.gold, fontSize: "9px" }}>◇</span>
            <span
              className="h-[1px] flex-1"
              style={{ background: RESTAURANT_WEB.gold }}
            />
          </div>
          <p
            className="mt-4 text-center font-display text-[15px] italic leading-[1.55]"
            style={{ color: RESTAURANT_WEB.ink, letterSpacing: "0.01em" }}
          >
            {wineNotes}
          </p>
          <div className="mt-4 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
            {topMicros.map((m, i) => (
              <span
                key={`wn-${i}`}
                className="flex items-baseline gap-1.5"
              >
                <span
                  className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em]"
                  style={{ color: RESTAURANT_WEB.gold }}
                >
                  {m.name}
                </span>
                {typeof m.pctDaily === "number" ? (
                  <span
                    className="font-mono text-[11px] font-bold"
                    style={{ color: RESTAURANT_WEB.ink }}
                  >
                    {m.pctDaily}%
                  </span>
                ) : null}
                {i < topMicros.length - 1 ? (
                  <span
                    className="ml-2"
                    style={{ color: RESTAURANT_WEB.gold, fontSize: "9px" }}
                  >
                    ·
                  </span>
                ) : null}
              </span>
            ))}
          </div>
          <p
            className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.18em]"
            style={{ color: RESTAURANT_WEB.inkSubtle }}
          >
            {nutritionBasisInline(recipe.nutritionBasis)}
          </p>
        </section>
      ) : null}

      {/* ── Story-Block (sparse) ── */}
      {showStory ? (
        <section className="mt-7 px-12">
          <blockquote
            className="border-l-[1.5px] pl-4 font-display text-[14px] italic leading-relaxed"
            style={{
              borderColor: RESTAURANT_WEB.gold,
              color: RESTAURANT_WEB.inkSoft,
            }}
          >
            {recipe.description}
          </blockquote>
        </section>
      ) : null}

      {/* ── Footer ── */}
      <footer
        className="mt-9 flex items-center justify-between gap-4 border-t px-8 py-5"
        style={{
          borderColor: RESTAURANT_WEB.divider,
          color: RESTAURANT_WEB.inkSoft,
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: RESTAURANT_WEB.gold, fontSize: "10px" }}>◆</span>
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
            style={{ color: RESTAURANT_WEB.gold }}
          >
            {recipe.sourceLabel ?? "Originalrezept"} ↗
          </a>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">
            Originalrezept
          </span>
        )}
      </footer>
    </article>
  );
}

function RestaurantSectionHeaderWeb({
  label,
  right,
}: {
  label: string;
  right: string;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span
          className="font-mono text-[11px] font-bold uppercase tracking-[0.32em]"
          style={{ color: RESTAURANT_WEB.ink }}
        >
          {label}
        </span>
        <span
          className="font-display text-[11px] italic"
          style={{ color: RESTAURANT_WEB.inkSubtle }}
        >
          {right}
        </span>
      </div>
      <div
        className="mt-1 h-[1px]"
        style={{ background: RESTAURANT_WEB.gold }}
      />
    </div>
  );
}

function RestaurantIngredientRowWeb({
  amount,
  name,
  note,
}: {
  amount: string;
  name: string;
  note?: string;
}) {
  const displayAmount = formatIngredientAmount(amount);
  // Web-Dot-Leader: CSS-Trick mit flex-basis + overflow + repeated "·".
  // Funktioniert ohne extra-JS und respektiert die Container-Breite.
  return (
    <div className="py-1.5">
      <div className="flex items-end gap-2">
        <span
          className="font-display text-[14px] leading-[1.3]"
          style={{ color: RESTAURANT_WEB.ink }}
        >
          {name}
        </span>
        <span
          className="relative flex-1 overflow-hidden whitespace-nowrap pb-[2px] font-mono"
          style={{
            color: RESTAURANT_WEB.gold,
            opacity: 0.55,
            letterSpacing: "0.25em",
            fontSize: "13px",
          }}
          aria-hidden
        >
          {"·".repeat(80)}
        </span>
        <span
          className="shrink-0 font-mono text-[14px] font-semibold tabular-nums"
          style={{ color: RESTAURANT_WEB.ink }}
        >
          {displayAmount}
        </span>
      </div>
      {note ? (
        <p
          className="mt-0.5 font-display text-[11px] italic"
          style={{ color: RESTAURANT_WEB.inkSubtle }}
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}

function restaurantGroupLabelWeb(name: string): string {
  return /^(den|die|das)\s/i.test(name)
    ? `Für ${name.toLowerCase()}`
    : name;
}

// ════════════════════════════════════════════════
// LAYOUT 12 (Phase D): STUDIO — Step-First Choreographie (Web-Mirror)
//
// Spiegel von lib/pdf/recipe-card-pdf.tsx#StudioPage. Die Zubereitung wird
// zum Helden: Big-Number-Steps links, kleiner 4:5-Hero rechts oben, Zutaten
// als fluide Inline-Linie unten, Mikros als prose im Footer. Auto-Fit über
// webGetDensity (3 Stufen) + studioWebTitleScale + 2-Spalten-Step-Splitter.
//
// Diese Web-Variante ist die Live-Preview im Recipe-Editor — die finale
// Druckausgabe ist die PDF-Page. Visuelle Beats müssen 1:1 matchen damit
// der User keinen Bruch zwischen Vorschau und Druck spürt.
// ════════════════════════════════════════════════
// Studio-Farben werden vom Pack-Mood abgeleitet (Mirror der PDF-Funktion
// studioColors). Background ist die Mood-Background-Farbe, Schriftfarben
// folgen mood.ink/inkSoft, abgeleitete Farben sind alpha-Variationen.
function studioWebColors(pack: Pack): {
  bg: string;
  ink: string;
  inkSoft: string;
  inkSubtle: string;
  inkFaint: string;
  divider: string;
} {
  const ink = pack.mood.ink;
  return {
    bg: pack.mood.background,
    ink,
    inkSoft: pack.mood.inkSoft,
    inkSubtle: hexWithAlpha(ink, 0.58),
    inkFaint: hexWithAlpha(ink, 0.32),
    divider: hexWithAlpha(ink, 0.18),
  };
}

// CSS-rgba aus Hex + Alpha. Inline statt Import von lib/pdf/theme um den
// Web-Bundle nicht auf react-pdf zu coupling.
function hexWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Web-Mirror von getStudioDensity (lib/pdf/recipe-card-pdf.tsx). Spacious-
// Schwelle ist grosszuegiger als globales getDensity (<= 17 statt <= 14)
// damit kurze Recipes grossen Hero + grossen Title bekommen statt halbleer
// auf der Karte zu sitzen.
function studioWebDensity(recipe: Recipe): WebDensity {
  if (recipe.tweaks?.densityOverride) return recipe.tweaks.densityOverride;
  const score = recipe.ingredients.length + recipe.steps.length * 1.5;
  if (score >= 22) return "compact";
  if (score <= 17) return "spacious";
  return "balanced";
}

// Density-Stufen für Web — gleiche Werte wie STUDIO_DENSITY im PDF (in px
// statt pt, aber die Skalierung gleicht aus weil der Web-Preview ohnehin
// größer dargestellt wird als 595×842 pt). Werte sind als CSS-Stringe
// ausgedrückt damit Tailwind via inline-style sie direkt frisst.
const STUDIO_WEB_DENSITY: Record<
  WebDensity,
  {
    heroWidth: number;
    heroHeight: number;
    titleFontSize: number;
    subtitleFontSize: number;
    specFontSize: number;
    sectionLabelFontSize: number;
    stepNumSize: number;
    stepNumColWidth: number;
    stepFontSize: number;
    stepGap: number;
    stepGroupLabelFontSize: number;
    ingredientFontSize: number;
    ingredientGroupLabelFontSize: number;
    storyFontSize: number;
    macroFontSize: number;
    macroLabelFontSize: number;
    microsFontSize: number;
    footerFontSize: number;
    eyebrowFontSize: number;
    sectionGap: number;
  }
> = {
  compact: {
    heroWidth: 128,
    heroHeight: 160,
    titleFontSize: 26,
    subtitleFontSize: 12,
    specFontSize: 10,
    sectionLabelFontSize: 10,
    stepNumSize: 20,
    stepNumColWidth: 36,
    stepFontSize: 12,
    stepGap: 7,
    stepGroupLabelFontSize: 11,
    ingredientFontSize: 11.5,
    ingredientGroupLabelFontSize: 10,
    storyFontSize: 12,
    macroFontSize: 13,
    macroLabelFontSize: 9.5,
    microsFontSize: 10.5,
    footerFontSize: 10,
    eyebrowFontSize: 10,
    sectionGap: 18,
  },
  balanced: {
    heroWidth: 156,
    heroHeight: 195,
    titleFontSize: 36,
    subtitleFontSize: 14,
    specFontSize: 11,
    sectionLabelFontSize: 10.5,
    stepNumSize: 26,
    stepNumColWidth: 44,
    stepFontSize: 13,
    stepGap: 11,
    stepGroupLabelFontSize: 12,
    ingredientFontSize: 13,
    ingredientGroupLabelFontSize: 11,
    storyFontSize: 13,
    macroFontSize: 14,
    macroLabelFontSize: 10,
    microsFontSize: 11.5,
    footerFontSize: 10.5,
    eyebrowFontSize: 10,
    sectionGap: 22,
  },
  spacious: {
    heroWidth: 208,
    heroHeight: 260,
    titleFontSize: 52,
    subtitleFontSize: 16,
    specFontSize: 12,
    sectionLabelFontSize: 11.5,
    stepNumSize: 34,
    stepNumColWidth: 58,
    stepFontSize: 15,
    stepGap: 20,
    stepGroupLabelFontSize: 13,
    ingredientFontSize: 14.5,
    ingredientGroupLabelFontSize: 12,
    storyFontSize: 15,
    macroFontSize: 16.5,
    macroLabelFontSize: 11,
    microsFontSize: 13,
    footerFontSize: 11.5,
    eyebrowFontSize: 11,
    sectionGap: 32,
  },
};

function studioWebGroupLabel(name: string): string {
  return /^(den|die|das)\s/i.test(name)
    ? `Für ${name.toLowerCase()}`
    : name;
}

// Macro-Stat-Helper (mirror der PDF-Version): nur Werte > 0 werden gerendert.
function studioWebMacros(
  recipe: Recipe
): Array<{ label: string; value: string }> {
  const n = recipe.nutrition;
  const entries: Array<{ label: string; value: string }> = [];
  if (n.kcal > 0) entries.push({ label: "KCAL", value: String(n.kcal) });
  if (n.protein > 0) entries.push({ label: "PROTEIN", value: `${n.protein} g` });
  if (n.carbs > 0) entries.push({ label: "KH", value: `${n.carbs} g` });
  if (n.fat > 0) entries.push({ label: "FETT", value: `${n.fat} g` });
  return entries;
}

function StudioSectionLabelWeb({
  label,
  fontSize,
  accent,
  divider,
}: {
  label: string;
  fontSize: number;
  accent: string;
  divider: string;
}) {
  return (
    <div className="my-6 flex items-center gap-3">
      <div className="h-px flex-1" style={{ backgroundColor: divider }} />
      <span
        className="font-semibold uppercase"
        style={{
          color: accent,
          fontSize: `${fontSize}px`,
          letterSpacing: "0.3em",
        }}
      >
        {label}
      </span>
      <div className="h-px flex-1" style={{ backgroundColor: divider }} />
    </div>
  );
}

function StudioStepRowWeb({
  index,
  text,
  density,
  accent,
  ink,
  divider,
}: {
  index: number;
  text: string;
  density: (typeof STUDIO_WEB_DENSITY)["balanced"];
  accent: string;
  ink: string;
  divider: string;
}) {
  return (
    <div className="flex items-start">
      <div
        className="shrink-0 pt-px"
        style={{ width: `${density.stepNumColWidth}px` }}
      >
        <span
          className="font-display font-medium"
          style={{
            color: accent,
            fontSize: `${density.stepNumSize}px`,
            lineHeight: 1,
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <div
        className="mx-3 self-stretch"
        style={{
          width: "0.5px",
          backgroundColor: divider,
          marginTop: "4px",
        }}
      />
      <p
        className="flex-1 pt-px"
        style={{
          color: ink,
          fontSize: `${density.stepFontSize}px`,
          lineHeight: 1.55,
        }}
      >
        {text}
      </p>
    </div>
  );
}

function StudioLayout({
  brand,
  pack,
  recipe,
  totalRecipes,
}: RecipeCardFullProps) {
  const c = studioWebColors(pack);
  // Studio-eigene Density-Heuristik mit grosszuegigerer Spacious-Schwelle —
  // kurze Recipes bekommen grosse Sizes statt halbleer balanced.
  const density = studioWebDensity(recipe);
  const d = STUDIO_WEB_DENSITY[density];
  const showStory = webShouldShowStory(recipe) && density !== "compact";
  const titleScale =
    studioWebTitleScale(recipe.title) +
    (recipe.tweaks?.titleScale ?? 0) * 0.03;
  const finalTitleSize = Math.round(d.titleFontSize * titleScale * 10) / 10;

  const ingredientGroups = groupIngredients(recipe.ingredients);
  const stepGroups = groupRecipeSteps(recipe.steps);

  const flatSteps: Array<
    | { kind: "group-label"; label: string }
    | { kind: "step"; index: number; text: string }
  > = [];
  stepGroups.forEach((g) => {
    if (g.name)
      flatSteps.push({ kind: "group-label", label: studioWebGroupLabel(g.name) });
    g.items.forEach((it) =>
      flatSteps.push({ kind: "step", index: it.index, text: it.text })
    );
  });
  const useTwoCol = flatSteps.length >= 10;
  const splitAt = useTwoCol ? Math.ceil(flatSteps.length / 2) : flatSteps.length;
  const leftSteps = flatSteps.slice(0, splitAt);
  const rightSteps = useTwoCol ? flatSteps.slice(splitAt) : [];

  const micros = visibleMicros(recipe).slice(0, 4);
  const macros = studioWebMacros(recipe);

  const totalMin = recipe.prepTime + (recipe.cookTime ?? 0);
  const specs: string[] = [];
  if (totalMin > 0) specs.push(`${totalMin} MIN`);
  const portionLabel = recipe.servings === 1 ? "PORTION" : "PORTIONEN";
  if (recipe.nutritionBasis === "piece") {
    specs.push(`${recipe.servings} ${recipe.servings === 1 ? "STÜCK" : "STÜCKE"}`);
  } else {
    specs.push(`${recipe.servings} ${portionLabel}`);
  }
  specs.push(recipe.difficulty.toUpperCase());

  const indexLabel =
    totalRecipes > 0
      ? `${String(recipe.number).padStart(2, "0")} / ${String(totalRecipes).padStart(2, "0")}`
      : null;

  const renderStepBlock = (
    items: typeof flatSteps,
    keyPrefix: string
  ) => (
    <div className="space-y-0">
      {items.map((item, i) => {
        if (item.kind === "group-label") {
          return (
            <p
              key={`${keyPrefix}-gl-${i}`}
              className="font-semibold uppercase"
              style={{
                color: c.inkSoft,
                fontSize: `${d.stepGroupLabelFontSize}px`,
                letterSpacing: "0.16em",
                marginTop: i === 0 ? 0 : `${d.stepGap + 2}px`,
                marginBottom: `${Math.max(d.stepGap - 4, 4)}px`,
              }}
            >
              {item.label}
            </p>
          );
        }
        const isLast = i === items.length - 1;
        return (
          <div
            key={`${keyPrefix}-s-${item.index}`}
            style={{ marginBottom: isLast ? 0 : `${d.stepGap}px` }}
          >
            <StudioStepRowWeb
              index={item.index}
              text={item.text}
              density={d}
              accent={pack.mood.accent}
              ink={c.ink}
              divider={c.divider}
            />
          </div>
        );
      })}
    </div>
  );

  return (
    <article
      className="mx-auto w-full max-w-[960px] overflow-hidden rounded-[var(--radius-card)] border bg-white"
      style={{
        ...baseShellStyle(pack, brand),
        backgroundColor: c.bg,
      }}
    >
      <div className="px-8 pt-10 pb-8 sm:px-14 sm:pt-12 sm:pb-10">
        {/* Eyebrow */}
        <div className="mb-3 flex items-center justify-between">
          <span
            className="font-semibold uppercase"
            style={{
              color: c.inkSubtle,
              fontSize: `${d.eyebrowFontSize}px`,
              letterSpacing: "0.32em",
            }}
          >
            {pack.category} · {pack.title}
          </span>
          {indexLabel ? (
            <span
              className="font-medium"
              style={{
                color: c.inkFaint,
                fontSize: `${d.eyebrowFontSize}px`,
                letterSpacing: "0.2em",
              }}
            >
              {indexLabel}
            </span>
          ) : null}
        </div>
        <div
          className="mb-7 h-px"
          style={{ backgroundColor: c.divider }}
        />

        {/* Header: Title links + Hero rechts */}
        <div className="flex items-start gap-6">
          <div className="min-w-0 flex-1">
            <h1
              className="font-display font-medium"
              style={{
                color: c.ink,
                fontSize: `${finalTitleSize}px`,
                lineHeight: 1.05,
              }}
            >
              {recipe.title}
            </h1>
            <div
              className="mt-3 mb-3 h-[2px] w-7"
              style={{ backgroundColor: pack.mood.accent }}
            />
            {recipe.subtitle ? (
              <p
                className="font-display italic"
                style={{
                  color: c.inkSoft,
                  fontSize: `${d.subtitleFontSize}px`,
                  lineHeight: 1.45,
                  marginBottom: "14px",
                }}
              >
                {recipe.subtitle}
              </p>
            ) : null}
            <p
              className="font-semibold uppercase"
              style={{
                color: c.inkSoft,
                fontSize: `${d.specFontSize}px`,
                letterSpacing: "0.26em",
              }}
            >
              {specs.join("  ·  ")}
            </p>
          </div>
          <div
            className="shrink-0 overflow-hidden"
            style={{
              width: `${d.heroWidth}px`,
              height: `${d.heroHeight}px`,
              backgroundColor: pack.mood.background + "60",
            }}
          >
            {recipe.hero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <Image
                src={recipe.hero}
                alt={recipe.title}
                width={d.heroWidth * 2}
                height={d.heroHeight * 2}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center"
                style={{ color: pack.mood.accent + "60" }}
              >
                <span
                  className="font-display"
                  style={{
                    fontSize: `${d.heroWidth * 0.5}px`,
                    lineHeight: 1,
                  }}
                >
                  {recipe.title.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>

        <div
          className="mt-8 h-px"
          style={{ backgroundColor: c.divider }}
        />

        {/* Choreographie */}
        <StudioSectionLabelWeb
          label="Die Choreographie"
          fontSize={d.sectionLabelFontSize}
          accent={pack.mood.accent}
          divider={c.divider}
        />
        {rightSteps.length === 0 ? (
          renderStepBlock(leftSteps, "single")
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {renderStepBlock(leftSteps, "L")}
            {renderStepBlock(rightSteps, "R")}
          </div>
        )}

        {/* Story-Pull-Quote (nur spacious + sparse) */}
        {showStory && recipe.description?.trim() ? (
          <div
            className="mx-auto my-7 flex max-w-xl flex-col items-center px-4"
          >
            <div
              className="mb-3 h-[1px] w-3.5"
              style={{ backgroundColor: pack.mood.accent }}
            />
            <p
              className="font-display text-center italic"
              style={{
                color: c.inkSoft,
                fontSize: `${d.storyFontSize}px`,
                lineHeight: 1.55,
              }}
            >
              {recipe.description}
            </p>
          </div>
        ) : (
          <div style={{ height: `${d.sectionGap}px` }} />
        )}

        {/* Zutaten Inline */}
        <StudioSectionLabelWeb
          label="Zutaten"
          fontSize={d.sectionLabelFontSize}
          accent={pack.mood.accent}
          divider={c.divider}
        />
        <div>
          {ingredientGroups.map((group, gi) => {
            const inline = group.items
              .map((it) => {
                const amount = formatIngredientAmount(it.amount);
                const note = it.note ? ` (${it.note})` : "";
                return amount
                  ? `${amount}  ${it.name}${note}`
                  : `${it.name}${note}`;
              })
              .join("  ·  ");
            return (
              <div
                key={gi}
                style={{ marginBottom: gi === ingredientGroups.length - 1 ? 0 : "10px" }}
              >
                {group.name ? (
                  <p
                    className="font-semibold uppercase"
                    style={{
                      color: c.inkSoft,
                      fontSize: `${d.ingredientGroupLabelFontSize}px`,
                      letterSpacing: "0.18em",
                      marginBottom: "4px",
                    }}
                  >
                    {studioWebGroupLabel(group.name)}
                  </p>
                ) : null}
                <p
                  style={{
                    color: c.ink,
                    fontSize: `${d.ingredientFontSize}px`,
                    lineHeight: 1.7,
                  }}
                >
                  {inline}
                </p>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          className="mt-8 h-px"
          style={{ backgroundColor: c.divider }}
        />
        {macros.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-baseline justify-center gap-x-4 gap-y-1">
            {macros.map((m, i) => (
              <span
                key={m.label}
                className="flex items-baseline gap-1"
              >
                <span
                  className="font-display font-medium"
                  style={{
                    color: c.ink,
                    fontSize: `${d.macroFontSize}px`,
                  }}
                >
                  {m.value}
                </span>
                <span
                  className="font-semibold uppercase"
                  style={{
                    color: c.inkSubtle,
                    fontSize: `${d.macroLabelFontSize}px`,
                    letterSpacing: "0.18em",
                  }}
                >
                  {m.label}
                </span>
                {i < macros.length - 1 ? (
                  <span
                    className="ml-1"
                    style={{
                      color: c.inkFaint,
                      fontSize: `${d.macroLabelFontSize}px`,
                    }}
                  >
                    ·
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}
        {micros.length > 0 ? (
          <p
            className="mt-3 text-center font-display italic"
            style={{
              color: c.inkSoft,
              fontSize: `${d.microsFontSize}px`,
              lineHeight: 1.5,
            }}
          >
            Reich an{" "}
            {micros
              .map(
                (m) =>
                  `${m.name}${
                    typeof m.pctDaily === "number" ? ` ${m.pctDaily} %` : ""
                  }`
              )
              .join(" · ")}
            .
          </p>
        ) : null}
        <div className="mt-5 flex items-center justify-between">
          <span
            className="font-medium uppercase"
            style={{
              color: c.inkSubtle,
              fontSize: `${d.footerFontSize}px`,
              letterSpacing: "0.2em",
            }}
          >
            {brand.handle} · {pack.title}
          </span>
        </div>
      </div>
    </article>
  );
}
