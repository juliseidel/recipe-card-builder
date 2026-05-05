import Image from "next/image";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";

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
// LAYOUT 1: EDITORIAL — Pack 1 (Feierabend, Honey)
// Klassisches Cookbook-Magazin: Hero-Bild full-width oben,
// klassische serif Typografie, viel Whitespace
// ════════════════════════════════════════════════
function EditorialLayout({
  brand,
  pack,
  recipe,
  totalRecipes,
}: RecipeCardFullProps) {
  const totalTime = recipe.prepTime + (recipe.cookTime ?? 0);
  return (
    <article
      className="mx-auto w-full max-w-[860px] overflow-hidden rounded-[var(--radius-card)] border bg-white"
      style={baseShellStyle(pack, brand)}
    >
      {/* Hero image full-width */}
      <div className="relative aspect-[16/9] overflow-hidden">
        <Image
          src={recipe.hero ?? pack.coverImage}
          alt={recipe.title}
          fill
          sizes="(min-width: 1024px) 860px, 100vw"
          className="object-cover"
          priority
        />
        <div
          className="absolute inset-0 mix-blend-multiply"
          style={{ background: pack.mood.background, opacity: 0.18 }}
        />
        <span
          className="absolute left-6 top-6 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] backdrop-blur"
          style={{ background: "rgba(255,255,255,0.92)", color: pack.mood.ink }}
        >
          Pack {String(pack.number).padStart(2, "0")} · Karte{" "}
          {String(recipe.number).padStart(2, "0")} / {String(totalRecipes).padStart(2, "0")}
        </span>
      </div>

      {/* Title block centered */}
      <div className="px-12 pt-12 pb-8 text-center">
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.22em]"
          style={{ color: pack.mood.inkSoft }}
        >
          {pack.title}
        </span>
        <h1
          className="mx-auto mt-4 max-w-[18ch] font-display text-[52px] uppercase leading-[1.0] tracking-[-0.01em] sm:text-[64px]"
          style={{ color: pack.mood.ink }}
        >
          {recipe.title}
        </h1>
        <p
          className="mx-auto mt-4 max-w-[42ch] font-display text-[20px] italic leading-snug"
          style={{ color: pack.mood.inkSoft }}
        >
          {recipe.subtitle}
        </p>

        {/* Stats inline */}
        <div
          className="mx-auto mt-8 inline-flex flex-wrap items-center justify-center gap-x-7 gap-y-2 border-t border-b py-4 text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{
            borderColor: pack.mood.ink + "22",
            color: pack.mood.inkSoft,
          }}
        >
          <span>{totalTime} Min</span>
          <span>·</span>
          <span>
            {recipe.servings} Portion{recipe.servings === 1 ? "" : "en"}
          </span>
          <span>·</span>
          <span>{recipe.difficulty}</span>
        </div>
      </div>

      {/* Body 2-column */}
      <div className="grid grid-cols-1 gap-12 px-12 pb-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <SectionList recipe={recipe} pack={pack} kind="ingredients" />
        <SectionList recipe={recipe} pack={pack} kind="steps" />
      </div>

      {/* Macros */}
      <MacrosBlock recipe={recipe} pack={pack} variant="strip" />

      {/* Micronutrients */}
      <MicrosBlock recipe={recipe} pack={pack} brand={brand} variant="grid" />

      <CardFooter brand={brand} pack={pack} />
    </article>
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
            <span>für {recipe.servings}</span>
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

      {/* Macros as elegant pill row */}
      <MacrosBlock recipe={recipe} pack={pack} variant="pills" />

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

      <MicrosBlock recipe={recipe} pack={pack} brand={brand} variant="tags" />
      <CardFooter brand={brand} pack={pack} italic />
    </article>
  );
}

// ════════════════════════════════════════════════
// LAYOUT 3: MINIMAL — Pack 3 (Blitz-Snacks, Mint)
// Apple-Vibe super clean: Recipe-Number 120px Hero,
// massive Whitespace, Bold Sans, kompakte Daten
// ════════════════════════════════════════════════
function MinimalLayout({
  brand,
  pack,
  recipe,
  totalRecipes,
}: RecipeCardFullProps) {
  const totalTime = recipe.prepTime + (recipe.cookTime ?? 0);
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
              pack={pack}
            />
            <MinStat
              value={`${recipe.nutrition.protein}g`}
              label="Eiweiß"
              pack={pack}
            />
            <MinStat
              value={`${totalTime}'`}
              label="Min"
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

      <MicrosBlock recipe={recipe} pack={pack} brand={brand} variant="minimal" />

      <CardFooter brand={brand} pack={pack} />
    </article>
  );
}

function MinStat({
  value,
  label,
  pack,
}: {
  value: string;
  label: string;
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
        className="text-[10px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: pack.mood.inkSoft }}
      >
        {label}
      </span>
    </div>
  );
}

// ════════════════════════════════════════════════
// LAYOUT 4: SPORT — Pack 4 (Volumen, Spring Green)
// Athletisches Cookbook: Hero-Bild mit Dark-Overlay,
// kcal als 80px Trophäe, bold uppercase Sans-Serif
// ════════════════════════════════════════════════
function SportLayout({
  brand,
  pack,
  recipe,
  totalRecipes,
}: RecipeCardFullProps) {
  const totalTime = recipe.prepTime + (recipe.cookTime ?? 0);
  return (
    <article
      className="mx-auto w-full max-w-[860px] overflow-hidden rounded-[var(--radius-card)] border bg-white"
      style={baseShellStyle(pack, brand)}
    >
      {/* Hero with athletic overlay */}
      <div className="relative aspect-[16/9] overflow-hidden text-white">
        <Image
          src={recipe.hero ?? pack.coverImage}
          alt={recipe.title}
          fill
          sizes="(min-width: 1024px) 860px, 100vw"
          className="object-cover"
          priority
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${pack.mood.ink}f0 0%, ${pack.mood.ink}aa 50%, ${pack.mood.accent}90 100%)`,
          }}
        />

        <div className="absolute inset-0 flex flex-col justify-between p-8">
          <div className="flex items-start justify-between">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em]">
              Pack {String(pack.number).padStart(2, "0")} · Karte{" "}
              {String(recipe.number).padStart(2, "0")} / {String(totalRecipes).padStart(2, "0")}
            </span>
            <span
              className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em]"
              style={{ color: pack.mood.ink }}
            >
              {totalTime} Min · {recipe.difficulty}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-baseline gap-3">
              <span className="font-sans text-[80px] font-bold leading-none tracking-[-0.03em] tabular-nums">
                {recipe.nutrition.kcal}
              </span>
              <span className="text-[16px] font-semibold uppercase tracking-[0.16em] text-white/85">
                kcal pro Portion
              </span>
            </div>
            <h1 className="max-w-[20ch] font-sans text-[44px] font-bold uppercase leading-[0.95] tracking-[-0.02em]">
              {recipe.title}
            </h1>
            <p className="text-[14px] uppercase tracking-[0.12em] text-white/80">
              {recipe.subtitle}
            </p>
          </div>
        </div>
      </div>

      <MacrosBlock recipe={recipe} pack={pack} variant="bold" />

      {/* Body */}
      <div className="grid grid-cols-1 gap-12 px-10 pt-12 pb-10 lg:grid-cols-[1fr_1.4fr] lg:gap-14">
        <SectionList recipe={recipe} pack={pack} kind="ingredients" bold />
        <SectionList recipe={recipe} pack={pack} kind="steps" bold />
      </div>

      <MicrosBlock recipe={recipe} pack={pack} brand={brand} variant="grid" />
      <CardFooter brand={brand} pack={pack} />
    </article>
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

          {/* Notion-style data rows */}
          <div
            className="mt-4 flex flex-col gap-px overflow-hidden rounded-lg border"
            style={{ borderColor: brand.tokens.line }}
          >
            <DashRow
              icon="⏱"
              label="Zubereitung"
              value={`${totalTime} Min`}
              pack={pack}
            />
            <DashRow
              icon="🍴"
              label="Portionen"
              value={String(recipe.servings)}
              pack={pack}
            />
            <DashRow
              icon="📊"
              label="Schwierigkeit"
              value={recipe.difficulty}
              pack={pack}
            />
            <DashRow
              icon="🔥"
              label="Kalorien"
              value={`${recipe.nutrition.kcal} kcal`}
              pack={pack}
            />
            <DashRow
              icon="💪"
              label="Eiweiß"
              value={`${recipe.nutrition.protein} g`}
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

      <MicrosBlock
        recipe={recipe}
        pack={pack}
        brand={brand}
        variant="dashboard"
      />
      <CardFooter brand={brand} pack={pack} />
    </article>
  );
}

function DashRow({
  icon,
  label,
  value,
  pack,
}: {
  icon: string;
  label: string;
  value: string;
  pack: Pack;
}) {
  return (
    <div
      className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 px-3 py-2 text-[13px]"
      style={{ background: "rgba(255,255,255,0.6)" }}
    >
      <span className="text-base">{icon}</span>
      <span style={{ color: pack.mood.inkSoft }}>{label}</span>
      <span
        className="font-mono text-[12px] font-semibold tabular-nums"
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
              className={`grid grid-cols-[4.2rem_1fr] items-baseline gap-3 ${
                minimal ? "py-2" : "border-b py-2.5"
              }`}
              style={{
                borderColor: pack.mood.ink + "12",
                color: pack.mood.ink,
              }}
            >
              <span
                className={`font-mono text-[12px] tabular-nums ${
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
          {recipe.steps.map((step, idx) => (
            <li key={idx} className="grid grid-cols-[2.2rem_1fr] gap-3">
              <span
                className={`font-display text-[28px] leading-none tabular-nums ${
                  bold ? "font-bold" : ""
                }`}
                style={{ color: pack.mood.accent }}
              >
                {idx + 1}
              </span>
              <span
                className="text-[15px] leading-[1.55]"
                style={{ color: pack.mood.ink }}
              >
                {step}
              </span>
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
}: {
  recipe: Recipe;
  pack: Pack;
  variant: "strip" | "pills" | "bold";
}) {
  const items = [
    { label: "Eiweiß", value: `${recipe.nutrition.protein}g` },
    { label: "Kohlenhydrate", value: `${recipe.nutrition.carbs}g` },
    { label: "Fett", value: `${recipe.nutrition.fat}g` },
  ];
  if (variant === "pills") {
    return (
      <div
        className="flex flex-wrap items-center justify-center gap-3 border-t border-b px-8 py-5"
        style={{ borderColor: pack.mood.ink + "20" }}
      >
        <span
          className="rounded-full px-4 py-1.5 text-[13px] font-semibold tabular-nums"
          style={{ background: pack.mood.ink, color: pack.mood.background }}
        >
          {recipe.nutrition.kcal} kcal
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

function MicrosBlock({
  recipe,
  pack,
  brand,
  variant,
}: {
  recipe: Recipe;
  pack: Pack;
  brand: Brand;
  variant: "grid" | "tags" | "minimal" | "dashboard";
}) {
  if (!recipe.nutrition.micros?.length) return null;

  if (variant === "tags") {
    return (
      <div
        className="flex flex-wrap items-center gap-2 px-10 py-6"
        style={{ background: pack.mood.background + "50" }}
      >
        <span
          className="text-[11px] font-semibold uppercase italic tracking-[0.18em]"
          style={{ color: pack.mood.inkSoft }}
        >
          Mikronährstoffe ·
        </span>
        {recipe.nutrition.micros.map((micro) => (
          <span
            key={micro.name}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium"
            style={{
              background: "rgba(255,255,255,0.7)",
              color: pack.mood.ink,
            }}
          >
            {micro.name}
            <span
              className="font-mono text-[10px] tabular-nums"
              style={{ color: pack.mood.inkSoft }}
            >
              {micro.amount}
              {micro.pctDaily !== undefined ? ` (${micro.pctDaily}%)` : ""}
            </span>
          </span>
        ))}
      </div>
    );
  }

  if (variant === "minimal") {
    return (
      <div
        className="border-t px-12 py-8"
        style={{ borderColor: brand.tokens.line }}
      >
        <h2
          className="text-[11px] font-semibold uppercase tracking-[0.22em]"
          style={{ color: pack.mood.inkSoft }}
        >
          Mikronährstoffe
        </h2>
        <table className="mt-4 w-full text-[13px]">
          <tbody>
            {recipe.nutrition.micros.map((micro) => (
              <tr
                key={micro.name}
                className="border-b last:border-b-0"
                style={{ borderColor: pack.mood.ink + "10" }}
              >
                <td className="py-2.5" style={{ color: pack.mood.ink }}>
                  {micro.name}
                </td>
                <td
                  className="py-2.5 text-right font-mono tabular-nums"
                  style={{ color: pack.mood.inkSoft }}
                >
                  {micro.amount}
                </td>
                <td
                  className="py-2.5 pl-4 text-right font-mono tabular-nums"
                  style={{ color: pack.mood.accent }}
                >
                  {micro.pctDaily !== undefined ? `${micro.pctDaily}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (variant === "dashboard") {
    return (
      <div
        className="border-t px-8 py-6"
        style={{ borderColor: brand.tokens.line, background: pack.mood.background + "30" }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: pack.mood.ink }}
          >
            🧪 Mikronährstoff-Datenbank
          </h2>
          <span
            className="font-mono text-[10px] uppercase tracking-[0.14em]"
            style={{ color: pack.mood.inkSoft }}
          >
            {recipe.nutrition.micros.length} Properties
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {recipe.nutrition.micros.map((micro) => (
            <div
              key={micro.name}
              className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
              style={{
                borderColor: pack.mood.ink + "1a",
                background: brand.tokens.surface,
              }}
            >
              <span
                className="text-[11px] font-medium"
                style={{ color: pack.mood.inkSoft }}
              >
                {micro.name}
              </span>
              <span
                className="font-mono text-[11px] font-semibold tabular-nums"
                style={{ color: pack.mood.ink }}
              >
                {micro.amount}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // grid variant (editorial / sport)
  return (
    <div className="px-8 pb-10 sm:px-12">
      <div
        className="overflow-hidden rounded-2xl border"
        style={{
          borderColor: pack.mood.ink + "20",
          background: pack.mood.background + "60",
        }}
      >
        <div
          className="flex items-center justify-between gap-3 border-b px-5 py-3"
          style={{ borderColor: pack.mood.ink + "1a" }}
        >
          <h2
            className="text-[12px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: pack.mood.accent }}
          >
            Mikronährstoffe
          </h2>
          <span
            className="text-[10px] font-medium uppercase tracking-[0.14em]"
            style={{ color: pack.mood.inkSoft }}
          >
            pro Portion · % vom Tagesbedarf
          </span>
        </div>
        <div className="grid grid-cols-2 gap-px sm:grid-cols-4">
          {recipe.nutrition.micros.map((micro) => (
            <div
              key={micro.name}
              className="flex flex-col gap-1 px-4 py-4"
              style={{ background: brand.tokens.surface }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: pack.mood.inkSoft }}
                >
                  {micro.name}
                </span>
                {micro.pctDaily !== undefined ? (
                  <span
                    className="font-mono text-[11px] font-semibold tabular-nums"
                    style={{ color: pack.mood.accent }}
                  >
                    {micro.pctDaily}%
                  </span>
                ) : null}
              </div>
              <span
                className="font-display text-[18px] leading-none tabular-nums"
                style={{ color: pack.mood.ink }}
              >
                {micro.amount}
              </span>
              {micro.pctDaily !== undefined ? (
                <div
                  className="mt-1 h-1 overflow-hidden rounded-full"
                  style={{ background: pack.mood.ink + "12" }}
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.min(micro.pctDaily, 100)}%`,
                      background: pack.mood.accent,
                    }}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CardFooter({
  brand,
  pack,
  italic = false,
}: {
  brand: Brand;
  pack: Pack;
  italic?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 border-t px-10 py-5"
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
      <span
        className="text-[11px] font-medium uppercase tracking-[0.16em]"
        style={{ color: brand.tokens.inkMuted }}
      >
        {brand.handle} · {pack.title}
      </span>
    </div>
  );
}
