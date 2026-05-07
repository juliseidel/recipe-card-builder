import Image from "next/image";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import {
  normalizeStep,
  nutritionBasisLabel,
  nutritionBasisLabelShort,
  nutritionBasisInline,
  type Recipe,
} from "@/lib/recipes";

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
};

export function RecipeCardFull(props: RecipeCardFullProps) {
  switch (props.pack.cardLayout) {
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
    const { group, remainingNote } = detectIngredientGroup(ing.note);
    const item = { amount: ing.amount, name: ing.name, note: remainingNote };
    if (group) {
      if (!groupMap.has(group)) {
        groupMap.set(group, { name: group, items: [] });
      }
      groupMap.get(group)!.items.push(item);
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
}: RecipeCardFullProps) {
  const totalTime = recipe.prepTime + (recipe.cookTime ?? 0);
  const grouped = groupIngredients(recipe.ingredients);
  const portionsLabel = recipe.servings === 1 ? "Portion" : "Portionen";

  return (
    <article
      className="mx-auto w-full max-w-[960px] overflow-hidden rounded-[var(--radius-card)] border bg-white"
      style={baseShellStyle(pack, brand)}
    >
      {/* TOP MARKER BAR */}
      <header
        className="flex items-center justify-between gap-3 border-b px-8 py-4 text-[10px] font-semibold uppercase tracking-[0.22em] sm:px-12"
        style={{
          borderColor: pack.mood.ink + "1a",
          background: pack.mood.background + "40",
        }}
      >
        <span style={{ color: pack.mood.inkSoft }}>
          Pack {String(pack.number).padStart(2, "0")} · {pack.title}
        </span>
        <span className="font-mono" style={{ color: pack.mood.inkSoft }}>
          Karte {String(recipe.number).padStart(2, "0")} /{" "}
          {String(totalRecipes).padStart(2, "0")}
        </span>
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
            <Image
              src={recipe.hero ?? pack.coverImage}
              alt={recipe.title}
              fill
              sizes="(min-width: 1024px) 320px, 100vw"
              className="object-cover"
              priority
            />
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
      <EditorialNutrientBanner recipe={recipe} pack={pack} />

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
            Bienes Story
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
function PatisserieLayout({
  brand,
  pack,
  recipe,
  totalRecipes,
}: RecipeCardFullProps) {
  const totalTime = recipe.prepTime + (recipe.cookTime ?? 0);
  const portionsLabel = recipe.servings === 1 ? "Stück" : "Stücke";
  return (
    <article
      className="mx-auto w-full max-w-[860px] overflow-hidden rounded-[var(--radius-card)] border"
      style={{
        ...baseShellStyle(pack, brand),
        background: pack.mood.background,
      }}
    >
      <div className="grid grid-cols-1 gap-8 px-10 pt-12 pb-8 lg:grid-cols-[1.3fr_1fr] lg:gap-12">
        <div className="flex flex-col gap-5">
          <span
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: pack.mood.inkSoft }}
          >
            № {String(recipe.number).padStart(2, "0")} / {String(totalRecipes).padStart(2, "0")} · {pack.title}
          </span>
          <h1
            className="font-display text-[60px] italic leading-[0.95] tracking-[-0.01em] sm:text-[72px]"
            style={{ color: pack.mood.ink }}
          >
            {recipe.title}
          </h1>
          <p
            className="font-display text-[22px] italic leading-snug"
            style={{ color: pack.mood.inkSoft }}
          >
            «&nbsp;{recipe.subtitle}&nbsp;»
          </p>
          <div
            className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px]"
            style={{ color: pack.mood.inkSoft }}
          >
            <span>{totalTime} Minuten</span>
            <span>·</span>
            <span>ergibt {recipe.servings} {portionsLabel}</span>
            <span>·</span>
            <span>{recipe.difficulty}</span>
          </div>
        </div>

        {/* Polaroid image right */}
        <div className="relative">
          <div
            className="relative mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-3xl border-8 border-white"
            style={{
              boxShadow:
                "0 1px 0 rgba(0,0,0,0.04), 0 22px 40px -16px rgba(0,0,0,0.22)",
              transform: "rotate(-2deg)",
            }}
          >
            <Image
              src={recipe.hero ?? pack.coverImage}
              alt={recipe.title}
              fill
              sizes="280px"
              className="object-cover"
              priority
            />
          </div>
        </div>
      </div>

      {/* Macros as elegant pill row — explicit "pro Stück" */}
      <MacrosBlock
        recipe={recipe}
        pack={pack}
        variant="pills"
        perPortionLabel={nutritionBasisInline(recipe.nutritionBasis)}
      />

      {/* Body */}
      <div
        className="grid grid-cols-1 gap-10 px-10 pt-10 pb-10 lg:grid-cols-[1fr_1.4fr] lg:gap-14"
        style={{ background: brand.tokens.surface }}
      >
        <SectionList
          recipe={recipe}
          pack={pack}
          kind="ingredients"
          headerStyle="italic"
        />
        <SectionList
          recipe={recipe}
          pack={pack}
          kind="steps"
          headerStyle="italic"
        />
      </div>

      <CardFooter brand={brand} pack={pack} recipe={recipe} italic />
    </article>
  );
}



// ════════════════════════════════════════════════
// LAYOUT 3: MINIMAL — Pack 3 (Snacks, Mint)
// Apple-Vibe super clean: Recipe-Number 140px Hero,
// massive Whitespace, Bold Sans, kompakte Daten
// ════════════════════════════════════════════════
function MinimalLayout({
  brand,
  pack,
  recipe,
  totalRecipes,
}: RecipeCardFullProps) {
  const totalTime = recipe.prepTime + (recipe.cookTime ?? 0);
  const portionsLabel = recipe.servings === 1 ? "Portion" : "Stücke";
  return (
    <article
      className="mx-auto w-full max-w-[860px] overflow-hidden rounded-[var(--radius-card)] border bg-white"
      style={baseShellStyle(pack, brand)}
    >
      <div className="grid grid-cols-1 gap-10 px-12 pt-12 pb-10 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-6">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: pack.mood.inkSoft }}
          >
            {pack.title} · {String(recipe.number).padStart(2, "0")} / {String(totalRecipes).padStart(2, "0")}
          </span>
          <span
            className="font-display text-[140px] leading-[0.85] tabular-nums"
            style={{ color: pack.mood.accent }}
          >
            {String(recipe.number).padStart(2, "0")}
          </span>
          <h1
            className="font-sans text-[44px] font-bold uppercase leading-[0.96] tracking-[-0.025em]"
            style={{ color: pack.mood.ink }}
          >
            {recipe.title}
          </h1>
          <p
            className="text-[15px] leading-snug"
            style={{ color: pack.mood.inkSoft }}
          >
            {recipe.subtitle}
          </p>
          <p
            className="text-[12px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: pack.mood.accent }}
          >
            ergibt {recipe.servings} {portionsLabel}
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <div
            className="relative aspect-square overflow-hidden rounded-2xl"
            style={{ background: pack.mood.background }}
          >
            <Image
              src={recipe.hero ?? pack.coverImage}
              alt={recipe.title}
              fill
              sizes="320px"
              className="object-cover"
              priority
            />
          </div>
          <div
            className="grid grid-cols-3 gap-3 rounded-2xl border p-4 text-center"
            style={{
              borderColor: pack.mood.ink + "1a",
              background: pack.mood.background + "50",
            }}
          >
            <MinStat
              value={String(recipe.nutrition.kcal)}
              label="kcal"
              sublabel={recipe.servings === 1 ? undefined : "pro Stück"}
              pack={pack}
            />
            <MinStat
              value={`${recipe.nutrition.protein}g`}
              label="Eiweiß"
              sublabel={recipe.servings === 1 ? undefined : "pro Stück"}
              pack={pack}
            />
            <MinStat
              value={`${totalTime}'`}
              label="Min"
              sublabel="Total"
              pack={pack}
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div
        className="grid grid-cols-1 gap-12 border-t px-12 pt-12 pb-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16"
        style={{ borderColor: brand.tokens.line }}
      >
        <SectionList recipe={recipe} pack={pack} kind="ingredients" minimal />
        <SectionList recipe={recipe} pack={pack} kind="steps" minimal />
      </div>

      <CardFooter brand={brand} pack={pack} recipe={recipe} />
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
            Pack {String(pack.number).padStart(2, "0")} · {pack.title} · Karte{" "}
            {String(recipe.number).padStart(2, "0")} /{" "}
            {String(totalRecipes).padStart(2, "0")}
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
            <Image
              src={recipe.hero ?? pack.coverImage}
              alt={recipe.title}
              fill
              sizes="(min-width: 1024px) 340px, 100vw"
              className="object-cover"
              priority
            />
          </div>
        </div>
      </header>

      {/* BIENES STORY — only shown when ingredients are sparse, fills the
          empty space short recipes would otherwise leave below. */}
      {isSparse && recipe.description ? (
        <div
          className="border-b px-8 py-6 sm:px-12"
          style={{
            borderColor: pack.mood.ink + "1a",
            background: pack.mood.background + "20",
          }}
        >
          <div
            className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: pack.mood.accent }}
          >
            Bienes Story
          </div>
          <p
            className="max-w-[60ch] font-display text-[17px] italic leading-relaxed"
            style={{ color: pack.mood.ink }}
          >
            {recipe.description}
          </p>
        </div>
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
            {recipe.ingredients.map((ing, idx) => (
              <li
                key={`${ing.name}-${idx}`}
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

      <CardFooter brand={brand} pack={pack} recipe={recipe} />
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
// LAYOUT 5: DASHBOARD — Pack 5 (Meal-Prep, Sky Blue)
// Notion-Template: strukturiert, day-of-week tags,
// data-rows, checklist style
// ════════════════════════════════════════════════
function DashboardLayout({
  brand,
  pack,
  recipe,
  totalRecipes,
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
        <span style={{ color: pack.mood.inkSoft }}>
          Pack {String(pack.number).padStart(2, "0")} · {pack.title}
        </span>
        <span style={{ color: pack.mood.inkSoft, opacity: 0.5 }}>·</span>
        <span style={{ color: pack.mood.inkSoft }}>
          Karte {String(recipe.number).padStart(2, "0")} / {String(totalRecipes).padStart(2, "0")}
        </span>
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
          <Image
            src={recipe.hero ?? pack.coverImage}
            alt={recipe.title}
            fill
            sizes="(min-width: 1024px) 360px, 100vw"
            className="object-cover"
            priority
          />
          <div
            className="absolute inset-0 mix-blend-multiply"
            style={{ background: pack.mood.background, opacity: 0.18 }}
          />
        </div>
      </div>

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

      <CardFooter brand={brand} pack={pack} recipe={recipe} />
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
}: {
  recipe: Recipe;
  pack: Pack;
  kind: "ingredients" | "steps";
  headerStyle?: "italic";
  minimal?: boolean;
  bold?: boolean;
  checklist?: boolean;
}) {
  const isIngredients = kind === "ingredients";
  const heading = isIngredients ? "Man nehme" : "Zubereitung";

  return (
    <div className="flex flex-col gap-4">
      <h2
        className={`text-[12px] font-semibold uppercase tracking-[0.22em] ${
          headerStyle === "italic" ? "italic" : ""
        }`}
        style={{ color: pack.mood.accent }}
      >
        {heading}
      </h2>
      {isIngredients ? (
        <ul className="flex flex-col">
          {recipe.ingredients.map((ingredient, idx) => (
            <li
              key={`${ingredient.name}-${idx}`}
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
                {checklist ? <span className="mr-2 opacity-50">☐</span> : null}
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
}: {
  brand: Brand;
  pack: Pack;
  recipe?: Recipe;
  italic?: boolean;
  // Pack 5 (Editorial) renders the micros banner at the top instead of in
  // the footer — set this to skip the default MicrosPanel rendering.
  hideMicros?: boolean;
}) {
  return (
    <>
      {hideMicros ? null : <MicrosPanel recipe={recipe} pack={pack} />}
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-t px-8 py-4 sm:px-10"
        style={{
          borderColor: brand.tokens.line,
          background: brand.tokens.surface,
        }}
      >
        <span
          className={`font-display text-[20px] ${italic ? "italic" : ""}`}
          style={{ color: brand.tokens.ink }}
        >
          {brand.signature}
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
