"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import {
  getCustomFitnessCardsForPack,
  removeCustomFitnessCard,
  type CustomFitnessCard,
} from "@/lib/fitness/custom-cards";
import type { FitnessCardType } from "@/lib/fitness/types";

// Placeholder-Grid fuer Fitness-Cards. Wird in Schritt 5/6 durch echte
// Card-Vorschau-Komponenten ersetzt (analog zu RecipeCardPreview).
// Aktueller Stand: Anzeige Titel + Type-Badge + Hero-Thumbnail. Reicht
// damit die Pack-Detail-Page nicht komplett leer ist sobald der erste
// Fitness-Pack existiert.

type FitnessCardGridProps = {
  brand: Brand;
  pack: Pack;
};

const TYPE_LABELS: Record<FitnessCardType, string> = {
  exercise: "Übung",
  workout: "Workout",
  weekplan: "Wochenplan",
  mindset: "Mindset",
  progress: "Tracker",
  "nutrition-tip": "Ernährung",
};

export function FitnessCardGrid({ brand, pack }: FitnessCardGridProps) {
  const router = useRouter();
  const [cards, setCards] = useState<CustomFitnessCard[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const list = await getCustomFitnessCardsForPack(brand.slug, pack.slug);
      if (!active) return;
      setCards(list);
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [brand.slug, pack.slug]);

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <NewFitnessCardCTA brand={brand} pack={pack} />

      {!loaded ? (
        <div
          className="flex aspect-[3/4] items-center justify-center rounded-[var(--radius-card)] border-2 border-dashed text-[12px] uppercase tracking-[0.18em]"
          style={{
            borderColor: pack.mood.ink + "20",
            color: pack.mood.inkSoft,
          }}
        >
          Lade Karten…
        </div>
      ) : null}

      {loaded && cards.length === 0 ? (
        <div
          className="col-span-full flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed py-16 text-center"
          style={{
            borderColor: pack.mood.ink + "20",
            color: pack.mood.inkSoft,
          }}
        >
          <p className="font-display text-[20px]" style={{ color: pack.mood.ink }}>
            Noch keine Karten in diesem Pack
          </p>
          <p className="max-w-[480px] text-[14px]">
            Lege die erste Übungs- oder Workout-Karte über &quot;Neue Karte&quot; an.
            Editor + KI-Auto-Pack-Vorschläge folgen in den nächsten Updates.
          </p>
        </div>
      ) : null}

      {cards.map((card) => (
        <FitnessCardThumbnail
          key={card.id}
          brand={brand}
          pack={pack}
          card={card}
          onDelete={async (id) => {
            setCards((prev) => prev.filter((c) => c.id !== id));
            const ok = await removeCustomFitnessCard(id);
            if (!ok) {
              const fresh = await getCustomFitnessCardsForPack(
                brand.slug,
                pack.slug
              );
              setCards(fresh);
              return;
            }
            router.refresh();
          }}
        />
      ))}
    </div>
  );
}

function NewFitnessCardCTA({ brand, pack }: { brand: Brand; pack: Pack }) {
  // Editor-Route kommt in Schritt 7. Vorher: Link auf bestehende /new-Route
  // (die wird in Schritt 7 erweitert um Fitness-Card-Type-Picker).
  return (
    <Link
      href={`/${brand.slug}/${pack.slug}/new-card`}
      className="group flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed transition hover:scale-[1.01]"
      style={{
        borderColor: pack.mood.accent + "60",
        background: pack.mood.background + "40",
      }}
    >
      <div
        className="grid h-12 w-12 place-items-center rounded-full text-[22px] transition group-hover:scale-110"
        style={{
          background: pack.mood.accent,
          color: pack.mood.background,
        }}
      >
        +
      </div>
      <p
        className="font-display text-[18px]"
        style={{ color: pack.mood.ink }}
      >
        Neue Karte
      </p>
      <p className="text-[12px] uppercase tracking-[0.18em]" style={{ color: pack.mood.inkSoft }}>
        Übung · Workout · Wochenplan
      </p>
    </Link>
  );
}

function FitnessCardThumbnail({
  brand,
  pack,
  card,
  onDelete,
}: {
  brand: Brand;
  pack: Pack;
  card: CustomFitnessCard;
  onDelete: (id: string) => void;
}) {
  return (
    <Link
      href={`/${brand.slug}/${pack.slug}/${card.slug}`}
      className="group relative flex aspect-[3/4] flex-col overflow-hidden rounded-[var(--radius-card)] border transition hover:scale-[1.01]"
      style={{
        borderColor: pack.mood.ink + "18",
        background: pack.mood.background,
      }}
    >
      <div
        className="relative flex-1 overflow-hidden"
        style={{
          background: card.hero
            ? `center / cover no-repeat url(${card.hero})`
            : pack.mood.ink + "08",
        }}
      >
        {!card.hero ? (
          <div
            className="grid h-full w-full place-items-center font-display text-[44px] opacity-30"
            style={{ color: pack.mood.ink }}
          >
            {card.number?.toString().padStart(2, "0") ?? "–"}
          </div>
        ) : null}
        <span
          className="absolute top-3 left-3 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]"
          style={{
            background: pack.mood.background,
            color: pack.mood.ink,
          }}
        >
          {TYPE_LABELS[card.type] ?? card.type}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm("Karte löschen?")) onDelete(card.id);
          }}
          className="absolute top-3 right-3 hidden h-7 w-7 items-center justify-center rounded-full text-[14px] opacity-80 transition hover:opacity-100 group-hover:flex"
          style={{
            background: pack.mood.background,
            color: pack.mood.ink,
          }}
          aria-label="Karte löschen"
        >
          ×
        </button>
      </div>
      <div
        className="border-t px-4 py-3"
        style={{ borderColor: pack.mood.ink + "15" }}
      >
        <p
          className="font-display text-[16px] leading-tight"
          style={{ color: pack.mood.ink }}
        >
          {card.title}
        </p>
        {card.subtitle ? (
          <p
            className="mt-1 text-[12px] leading-tight"
            style={{ color: pack.mood.inkSoft }}
          >
            {card.subtitle}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
