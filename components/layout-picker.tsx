"use client";

import type { CardLayout } from "@/lib/packs";
import { layoutPresets } from "@/lib/pack-presets";

type LayoutPickerProps = {
  value: CardLayout;
  onChange: (id: CardLayout) => void;
  accent: string;
  // When this prop is provided, the picker draws the active accent against
  // the picker's own backdrop — used in the pack editor where the mood is
  // unified. Recipe editor passes a neutral pack-mood so all five thumbnails
  // read the same.
  thumbnailMood?: { background: string; accent: string; ink: string };
};

export function LayoutPicker({
  value,
  onChange,
  accent,
  thumbnailMood,
}: LayoutPickerProps) {
  const mood = thumbnailMood ?? {
    background: "#f5f1e8",
    accent,
    ink: "#1a120b",
  };
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {layoutPresets.map((preset) => {
        const active = value === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.id)}
            className="flex flex-col items-start gap-1.5 rounded-2xl border-2 p-4 text-left transition-all"
            style={{
              borderColor: active ? accent : "var(--color-line)",
              background: active ? accent + "10" : "white",
            }}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span
                className="text-[14px] font-semibold"
                style={{ color: active ? accent : "var(--color-ink)" }}
              >
                {preset.title}
              </span>
              <LayoutThumbnail layout={preset.id} mood={mood} />
            </div>
            <p
              className="text-[12px] leading-snug"
              style={{ color: "var(--color-ink-muted)" }}
            >
              {preset.description}
            </p>
            <p
              className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: "var(--color-ink-subtle)" }}
            >
              Best für: {preset.bestFor}
            </p>
          </button>
        );
      })}
    </div>
  );
}

// Tiny SVG schematic showing each layout's structural fingerprint. Used by
// the layout picker — not pixel-perfect, just enough to differentiate
// "magazine" vs "polaroid" vs "minimal-with-mega-number" vs "macro-bars"
// vs "data-rows" at thumbnail size.
export function LayoutThumbnail({
  layout,
  mood,
}: {
  layout: CardLayout;
  mood: { background: string; accent: string; ink: string };
}) {
  const stroke = mood.ink;
  const fill = mood.accent;
  const bg = mood.background;
  return (
    <svg width="48" height="36" viewBox="0 0 48 36" aria-hidden>
      <rect width="48" height="36" rx="4" fill={bg} opacity="0.5" />
      {layout === "editorial" && (
        <>
          <rect
            x="3"
            y="3"
            width="42"
            height="10"
            rx="1.5"
            fill={fill}
            opacity="0.75"
          />
          <rect x="3" y="15" width="22" height="2" rx="0.5" fill={stroke} />
          <rect
            x="3"
            y="19"
            width="14"
            height="2"
            rx="0.5"
            fill={stroke}
            opacity="0.6"
          />
          <rect
            x="3"
            y="25"
            width="42"
            height="2"
            rx="0.5"
            fill={fill}
            opacity="0.4"
          />
          <rect
            x="3"
            y="29"
            width="42"
            height="2"
            rx="0.5"
            fill={fill}
            opacity="0.4"
          />
        </>
      )}
      {layout === "patisserie" && (
        <>
          {/* Lavender sidebar (left 40%) — title + tilted polaroid +
              vertical micros list + avatar anchor at the bottom */}
          <rect
            x="0"
            y="0"
            width="19"
            height="32"
            fill={fill}
            opacity="0.85"
          />
          <rect x="2" y="3" width="14" height="2" rx="0.4" fill={stroke} />
          <rect
            x="2"
            y="6.5"
            width="11"
            height="1.5"
            rx="0.4"
            fill={stroke}
            opacity="0.55"
          />
          <rect
            x="3"
            y="10.5"
            width="13"
            height="9"
            rx="1"
            fill="white"
            transform="rotate(-3 9.5 15)"
          />
          <rect
            x="2"
            y="22"
            width="13"
            height="0.7"
            rx="0.3"
            fill={stroke}
            opacity="0.45"
          />
          <rect
            x="2"
            y="23.6"
            width="13"
            height="0.7"
            rx="0.3"
            fill={stroke}
            opacity="0.45"
          />
          <rect
            x="2"
            y="25.2"
            width="13"
            height="0.7"
            rx="0.3"
            fill={stroke}
            opacity="0.45"
          />
          <circle cx="4.5" cy="29.5" r="1.5" fill={stroke} opacity="0.7" />
          <rect
            x="7"
            y="29"
            width="8"
            height="1.2"
            rx="0.3"
            fill={stroke}
            opacity="0.55"
          />

          {/* Cream body column (right 60%) — stats strip + macro pills +
              ingredients/steps lines */}
          <rect
            x="22"
            y="3"
            width="9"
            height="2"
            rx="0.4"
            fill={stroke}
            opacity="0.8"
          />
          <rect
            x="38"
            y="3"
            width="8"
            height="2"
            rx="0.4"
            fill={stroke}
            opacity="0.8"
          />
          <rect
            x="22"
            y="7"
            width="6"
            height="1.6"
            rx="0.8"
            fill={fill}
            opacity="0.55"
          />
          <rect
            x="29"
            y="7"
            width="7"
            height="1.6"
            rx="0.8"
            fill={fill}
            opacity="0.55"
          />
          <rect
            x="37"
            y="7"
            width="5"
            height="1.6"
            rx="0.8"
            fill={fill}
            opacity="0.55"
          />
          <rect
            x="22"
            y="12"
            width="22"
            height="1.4"
            rx="0.3"
            fill={stroke}
            opacity="0.45"
          />
          <rect
            x="22"
            y="14.5"
            width="20"
            height="1.4"
            rx="0.3"
            fill={stroke}
            opacity="0.4"
          />
          <rect
            x="22"
            y="17"
            width="22"
            height="1.4"
            rx="0.3"
            fill={stroke}
            opacity="0.4"
          />
          <rect
            x="22"
            y="22"
            width="22"
            height="1.4"
            rx="0.3"
            fill={stroke}
            opacity="0.55"
          />
          <rect
            x="22"
            y="24.5"
            width="18"
            height="1.4"
            rx="0.3"
            fill={stroke}
            opacity="0.4"
          />
          <rect
            x="22"
            y="27"
            width="22"
            height="1.4"
            rx="0.3"
            fill={stroke}
            opacity="0.4"
          />
        </>
      )}
      {layout === "minimal" && (
        <>
          {/* Cookbook-Cover: Hero fuellt die obere Haelfte (full-bleed),
              Title-Overlay unten links auf dem Hero, Avatar als runder
              Stempel rechts auf dem Hero. Darunter Spec-Strip in
              Mood-Farbe und 2-Spalten-Body. */}
          {/* Hero (full-width, top half) — dark fill represents image */}
          <rect x="0" y="0" width="48" height="14" fill={stroke} opacity="0.75" />
          {/* Caption oben links auf Hero */}
          <rect
            x="2"
            y="2"
            width="9"
            height="0.9"
            rx="0.2"
            fill="white"
            opacity="0.85"
          />
          {/* Title-Overlay unten links auf Hero */}
          <rect x="2" y="9.5" width="22" height="2.2" rx="0.3" fill="white" />
          <rect
            x="2"
            y="12.2"
            width="14"
            height="1"
            rx="0.2"
            fill="white"
            opacity="0.85"
          />
          {/* Avatar-Stempel rechts unten auf Hero */}
          <circle cx="44" cy="11" r="2.2" fill="white" />
          <circle cx="44" cy="11" r="1.6" fill={fill} />

          {/* Spec-Strip in Mood-Farbe */}
          <rect x="0" y="14" width="48" height="3.6" fill={fill} opacity="0.85" />
          <rect x="3" y="15.4" width="3" height="1" rx="0.2" fill={stroke} />
          <rect x="9" y="15.4" width="3" height="1" rx="0.2" fill={stroke} />
          <rect x="15" y="15.4" width="3" height="1" rx="0.2" fill={stroke} />
          <rect x="22" y="15.4" width="3" height="1" rx="0.2" fill={stroke} />
          <rect x="29" y="15.4" width="3" height="1" rx="0.2" fill={stroke} />
          <rect x="36" y="15.4" width="3" height="1" rx="0.2" fill={stroke} />

          {/* Body 2-Spalten */}
          <rect
            x="3"
            y="19.5"
            width="6"
            height="0.7"
            rx="0.2"
            fill={fill}
            opacity="0.9"
          />
          <rect
            x="3"
            y="21.2"
            width="14"
            height="1"
            rx="0.2"
            fill={stroke}
            opacity="0.55"
          />
          <rect
            x="3"
            y="22.8"
            width="13"
            height="1"
            rx="0.2"
            fill={stroke}
            opacity="0.45"
          />
          <rect
            x="3"
            y="24.4"
            width="12"
            height="1"
            rx="0.2"
            fill={stroke}
            opacity="0.45"
          />
          <rect
            x="22"
            y="19.5"
            width="6"
            height="0.7"
            rx="0.2"
            fill={fill}
            opacity="0.9"
          />
          <rect
            x="22"
            y="21.2"
            width="22"
            height="1"
            rx="0.2"
            fill={stroke}
            opacity="0.55"
          />
          <rect
            x="22"
            y="22.8"
            width="20"
            height="1"
            rx="0.2"
            fill={stroke}
            opacity="0.45"
          />
          <rect
            x="22"
            y="24.4"
            width="22"
            height="1"
            rx="0.2"
            fill={stroke}
            opacity="0.45"
          />

          {/* Mikros-Capsule-Strip am unteren Rand */}
          <rect x="0" y="27" width="48" height="3" fill={fill} opacity="0.4" />
          <rect
            x="2"
            y="28"
            width="6"
            height="1.2"
            rx="0.6"
            fill="white"
            opacity="0.95"
          />
          <rect
            x="9"
            y="28"
            width="7"
            height="1.2"
            rx="0.6"
            fill="white"
            opacity="0.95"
          />
          <rect
            x="17"
            y="28"
            width="6"
            height="1.2"
            rx="0.6"
            fill="white"
            opacity="0.95"
          />
          <rect
            x="24"
            y="28"
            width="7"
            height="1.2"
            rx="0.6"
            fill="white"
            opacity="0.95"
          />
        </>
      )}
      {layout === "sport" && (
        <>
          <rect
            x="3"
            y="3"
            width="14"
            height="2"
            rx="0.5"
            fill={stroke}
            opacity="0.5"
          />
          <rect x="3" y="9" width="22" height="3" rx="0.5" fill={stroke} />
          <rect x="3" y="16" width="20" height="3" rx="1.5" fill={fill} />
          <rect
            x="3"
            y="22"
            width="14"
            height="3"
            rx="1.5"
            fill={fill}
            opacity="0.7"
          />
          <rect
            x="3"
            y="28"
            width="18"
            height="3"
            rx="1.5"
            fill={fill}
            opacity="0.5"
          />
          <rect
            x="29"
            y="9"
            width="16"
            height="22"
            rx="1.5"
            fill={fill}
            opacity="0.7"
          />
        </>
      )}
      {layout === "dashboard" && (
        <>
          <rect
            x="3"
            y="3"
            width="42"
            height="6"
            rx="1"
            fill={fill}
            opacity="0.6"
          />
          <rect x="3" y="13" width="22" height="2" rx="0.5" fill={stroke} />
          <rect
            x="3"
            y="18"
            width="14"
            height="2"
            rx="0.5"
            fill={stroke}
            opacity="0.5"
          />
          <rect
            x="3"
            y="23"
            width="14"
            height="2"
            rx="0.5"
            fill={stroke}
            opacity="0.5"
          />
          <rect
            x="3"
            y="28"
            width="14"
            height="2"
            rx="0.5"
            fill={stroke}
            opacity="0.5"
          />
          <rect
            x="29"
            y="13"
            width="16"
            height="18"
            rx="1"
            fill={fill}
            opacity="0.6"
          />
        </>
      )}
    </svg>
  );
}
