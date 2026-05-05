import Image from "next/image";
import Link from "next/link";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";

type RecipeCardPreviewProps = {
  brand: Brand;
  pack: Pack;
  recipe: Recipe;
};

export function RecipeCardPreview(props: RecipeCardPreviewProps) {
  switch (props.pack.cardLayout) {
    case "editorial":
      return <EditorialCard {...props} />;
    case "patisserie":
      return <PatisserieCard {...props} />;
    case "minimal":
      return <MinimalCard {...props} />;
    case "sport":
      return <SportCard {...props} />;
    case "dashboard":
      return <DashboardCard {...props} />;
  }
}

// Position variation so identical pack-cover images don't look repetitive
const positions = [
  "object-center",
  "object-top",
  "object-[center_30%]",
  "object-[center_70%]",
  "object-[35%_center]",
  "object-[65%_center]",
  "object-[40%_30%]",
  "object-[60%_70%]",
];
const positionFor = (n: number) => positions[(n - 1) % positions.length];

// ─────────────────────────────────────────
// Layout 1: EDITORIAL (Pack 1 · Feierabend)
// Bild als Hero-Background, text-dominant Typografie wie ein Magazin
// ─────────────────────────────────────────
function EditorialCard({ brand, pack, recipe }: RecipeCardPreviewProps) {
  const totalTime = recipe.prepTime + (recipe.cookTime ?? 0);
  return (
    <Link
      href={`/${brand.slug}/${pack.slug}/${recipe.slug}`}
      className="group relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-[var(--radius-card)] p-6 text-white transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[var(--shadow-card-hover)]"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <Image
        src={pack.coverImage}
        alt={recipe.title}
        fill
        sizes="(min-width: 1280px) 420px, (min-width: 768px) 50vw, 100vw"
        className={`${positionFor(recipe.number)} object-cover transition-transform duration-700 group-hover:scale-[1.06]`}
      />
      <div
        className="absolute inset-0 mix-blend-multiply"
        style={{ background: pack.mood.background, opacity: 0.78 }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-3/5"
        style={{
          background:
            "linear-gradient(to top, rgba(15,12,8,0.75), rgba(15,12,8,0) 100%)",
        }}
      />

      <div className="relative z-10 flex items-center justify-between">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-white/85">
          Karte {String(recipe.number).padStart(2, "0")}
        </span>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] backdrop-blur"
          style={{ background: "rgba(255,255,255,0.92)", color: pack.mood.ink }}
        >
          {totalTime} Min
        </span>
      </div>

      <div className="relative z-10 flex flex-col gap-2.5">
        <h3 className="font-display text-[28px] uppercase leading-[0.96] text-white">
          {recipe.title}
        </h3>
        <p className="font-display text-[14px] italic leading-tight text-white/80">
          {recipe.subtitle}
        </p>
        <div className="mt-2 flex items-baseline gap-3 border-t border-white/25 pt-2.5 text-[12px] text-white/85">
          <span className="font-display text-[20px] tabular-nums text-white">
            {recipe.nutrition.kcal}
          </span>
          <span className="text-[10px] uppercase tracking-[0.16em]">kcal</span>
          <span className="opacity-50">·</span>
          <span className="font-display text-[20px] tabular-nums text-white">
            {recipe.nutrition.protein}g
          </span>
          <span className="text-[10px] uppercase tracking-[0.16em]">Eiweiß</span>
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────
// Layout 2: PATISSERIE (Pack 2 · Backwelt)
// Boutique-Bäckerei: rundes Polaroid-Bild oben, cream paper darunter
// ─────────────────────────────────────────
function PatisserieCard({ brand, pack, recipe }: RecipeCardPreviewProps) {
  const totalTime = recipe.prepTime + (recipe.cookTime ?? 0);
  return (
    <Link
      href={`/${brand.slug}/${pack.slug}/${recipe.slug}`}
      className="group flex aspect-[3/4] flex-col overflow-hidden rounded-[var(--radius-card)] p-6 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[var(--shadow-card-hover)]"
      style={{
        background: brand.tokens.surface,
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Polaroid image */}
      <div
        className="relative mb-4 aspect-square overflow-hidden rounded-2xl"
        style={{ background: pack.mood.background }}
      >
        <Image
          src={pack.coverImage}
          alt={recipe.title}
          fill
          sizes="(min-width: 1280px) 360px, (min-width: 768px) 40vw, 90vw"
          className={`${positionFor(recipe.number)} object-cover transition-transform duration-700 group-hover:scale-[1.04]`}
        />
        <div
          className="absolute inset-0 mix-blend-multiply"
          style={{ background: pack.mood.background, opacity: 0.18 }}
        />
        <span
          className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] backdrop-blur"
          style={{ background: "rgba(255,255,255,0.92)", color: pack.mood.ink }}
        >
          {totalTime} Min
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <span
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: pack.mood.inkSoft }}
        >
          № {String(recipe.number).padStart(2, "0")}
        </span>
        <h3
          className="font-display text-[24px] italic leading-[1.05]"
          style={{ color: pack.mood.ink }}
        >
          {recipe.title}
        </h3>
        <p
          className="text-[12px] leading-snug"
          style={{ color: pack.mood.inkSoft }}
        >
          {recipe.subtitle}
        </p>
        <div
          className="mt-auto flex items-baseline gap-2 border-t pt-3"
          style={{ borderColor: pack.mood.ink + "20" }}
        >
          <span
            className="font-display text-[20px] tabular-nums"
            style={{ color: pack.mood.ink }}
          >
            {recipe.nutrition.kcal}
          </span>
          <span
            className="text-[10px] uppercase tracking-[0.14em]"
            style={{ color: pack.mood.inkSoft }}
          >
            kcal · {recipe.nutrition.protein}g Eiweiß
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────
// Layout 3: MINIMAL (Pack 3 · Blitz-Snacks)
// Apple-Vibe: viel Whitespace, Recipe-Number als Hero, kleines Bild
// ─────────────────────────────────────────
function MinimalCard({ brand, pack, recipe }: RecipeCardPreviewProps) {
  const totalTime = recipe.prepTime + (recipe.cookTime ?? 0);
  return (
    <Link
      href={`/${brand.slug}/${pack.slug}/${recipe.slug}`}
      className="group flex aspect-[3/4] flex-col overflow-hidden rounded-[var(--radius-card)] p-7 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[var(--shadow-card-hover)]"
      style={{
        background: brand.tokens.surface,
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-start justify-between">
        <span
          className="font-display text-[64px] leading-none tabular-nums"
          style={{ color: pack.mood.accent }}
        >
          {String(recipe.number).padStart(2, "0")}
        </span>
        <div
          className="relative size-16 overflow-hidden rounded-2xl"
          style={{ background: pack.mood.background }}
        >
          <Image
            src={pack.coverImage}
            alt={recipe.title}
            fill
            sizes="64px"
            className={`${positionFor(recipe.number)} object-cover`}
          />
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2.5">
        <h3
          className="font-sans text-[26px] font-bold leading-[0.98] tracking-[-0.02em]"
          style={{ color: pack.mood.ink }}
        >
          {recipe.title}
        </h3>
        <p
          className="text-[12px] leading-snug"
          style={{ color: pack.mood.inkSoft }}
        >
          {recipe.subtitle}
        </p>
        <div
          className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-[11px]"
          style={{ borderColor: pack.mood.ink + "1a" }}
        >
          <Stat
            value={String(recipe.nutrition.kcal)}
            label="kcal"
            pack={pack}
          />
          <Stat
            value={`${recipe.nutrition.protein}g`}
            label="Eiweiß"
            pack={pack}
          />
          <Stat value={`${totalTime}'`} label="Min" pack={pack} />
        </div>
      </div>
    </Link>
  );
}

function Stat({
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
        className="font-sans text-[16px] font-semibold tabular-nums"
        style={{ color: pack.mood.ink }}
      >
        {value}
      </span>
      <span
        className="text-[9px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: pack.mood.inkSoft }}
      >
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────
// Layout 4: SPORT (Pack 4 · Volumen-Wunder)
// Bold Typografie, kcal als Trophäe, dunkleres Image-Overlay
// ─────────────────────────────────────────
function SportCard({ brand, pack, recipe }: RecipeCardPreviewProps) {
  const totalTime = recipe.prepTime + (recipe.cookTime ?? 0);
  return (
    <Link
      href={`/${brand.slug}/${pack.slug}/${recipe.slug}`}
      className="group relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-[var(--radius-card)] text-white transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[var(--shadow-card-hover)]"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <Image
        src={pack.coverImage}
        alt={recipe.title}
        fill
        sizes="(min-width: 1280px) 420px, (min-width: 768px) 50vw, 100vw"
        className={`${positionFor(recipe.number)} object-cover transition-transform duration-700 group-hover:scale-[1.06]`}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${pack.mood.ink}cc 0%, ${pack.mood.ink}88 60%, ${pack.mood.accent}80 100%)`,
        }}
      />

      <div className="relative z-10 flex items-start justify-between p-5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-white/85">
          Pack {String(pack.number).padStart(2, "0")} · Karte{" "}
          {String(recipe.number).padStart(2, "0")}
        </span>
        <span
          className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
          style={{ color: pack.mood.ink }}
        >
          {totalTime} Min
        </span>
      </div>

      <div className="relative z-10 flex flex-col gap-3 px-5 pb-6">
        {/* kcal as trophy */}
        <div className="flex items-baseline gap-2">
          <span className="font-sans text-[64px] font-bold leading-none tracking-[-0.03em] tabular-nums">
            {recipe.nutrition.kcal}
          </span>
          <span className="text-[14px] font-semibold uppercase tracking-[0.16em] text-white/85">
            kcal
          </span>
        </div>
        <h3 className="font-sans text-[24px] font-bold uppercase leading-[0.96] tracking-[-0.02em]">
          {recipe.title}
        </h3>
        <div
          className="flex items-center gap-2 border-t border-white/30 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85"
        >
          <span>{recipe.nutrition.protein}g Eiweiß</span>
          <span>·</span>
          <span>{recipe.servings}× Portion</span>
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────
// Layout 5: DASHBOARD (Pack 5 · Meal-Prep)
// Notion-Template-Vibe: tabular, organisiert, plan-mäßig
// ─────────────────────────────────────────
function DashboardCard({ brand, pack, recipe }: RecipeCardPreviewProps) {
  const totalTime = recipe.prepTime + (recipe.cookTime ?? 0);
  const weekDay = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][
    (recipe.number - 1) % 7
  ];
  return (
    <Link
      href={`/${brand.slug}/${pack.slug}/${recipe.slug}`}
      className="group flex aspect-[3/4] flex-col overflow-hidden rounded-[var(--radius-card)] transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[var(--shadow-card-hover)]"
      style={{
        background: brand.tokens.surface,
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Header tag-row like a Notion card */}
      <div
        className="flex items-center justify-between gap-3 border-b px-5 py-3"
        style={{ borderColor: pack.mood.ink + "1a" }}
      >
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{
            background: pack.mood.background,
            color: pack.mood.ink,
          }}
        >
          {weekDay} · {totalTime} Min
        </span>
        <span
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: pack.mood.inkSoft }}
        >
          {String(recipe.number).padStart(2, "0")}/07
        </span>
      </div>

      {/* Compact image strip */}
      <div className="relative h-32 overflow-hidden">
        <Image
          src={pack.coverImage}
          alt={recipe.title}
          fill
          sizes="(min-width: 1280px) 420px, (min-width: 768px) 50vw, 100vw"
          className={`${positionFor(recipe.number)} object-cover transition-transform duration-700 group-hover:scale-[1.04]`}
        />
        <div
          className="absolute inset-0 mix-blend-multiply"
          style={{ background: pack.mood.background, opacity: 0.42 }}
        />
      </div>

      {/* Title + structured data rows */}
      <div className="flex flex-1 flex-col gap-3 px-5 py-5">
        <h3
          className="font-display text-[22px] leading-[1.05]"
          style={{ color: pack.mood.ink }}
        >
          {recipe.title}
        </h3>

        <div
          className="flex flex-col gap-1.5 text-[11px]"
          style={{ color: pack.mood.inkSoft }}
        >
          <Row label="Kalorien" value={`${recipe.nutrition.kcal} kcal`} />
          <Row label="Eiweiß" value={`${recipe.nutrition.protein} g`} />
          <Row
            label="Schwierigkeit"
            value={recipe.difficulty}
          />
        </div>
      </div>
    </Link>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 tabular-nums">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
        {label}
      </span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}
