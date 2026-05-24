"use client";

import type { Recipe } from "@/types/recipe";
import { formatNumber } from "@/lib/utils";
import { motion, type HTMLMotionProps, type Transition } from "framer-motion";
import type { ReactNode, CSSProperties } from "react";

/* ─────────────────────────────────────────────────────────────
 * Hairline — soft horizontal rule, scoped to current colour
 * ───────────────────────────────────────────────────────────── */

export function Hairline({
  weight = 0.5,
  className = "",
  style,
}: {
  weight?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      role="presentation"
      className={`block w-full ${className}`}
      style={{ height: weight, background: "currentColor", opacity: 0.18, ...style }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────
 * Eyebrow — small uppercase label
 * ───────────────────────────────────────────────────────────── */

export function Eyebrow({
  children,
  size = "sm",
  className = "",
  style,
}: {
  children: ReactNode;
  size?: "xs" | "sm" | "md";
  className?: string;
  style?: CSSProperties;
}) {
  const fontSize =
    size === "xs" ? "9px" : size === "md" ? "12px" : "10.5px";
  return (
    <span
      className={`inline-block uppercase ${className}`}
      style={{
        fontFamily: "var(--font-mono)",
        fontWeight: 500,
        letterSpacing: "0.22em",
        fontSize,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * NumeralStack — large numeric display with caption
 * ───────────────────────────────────────────────────────────── */

export function NumeralStack({
  value,
  unit,
  label,
  fontFamily,
  size = "md",
}: {
  value: string | number;
  unit?: string;
  label: string;
  fontFamily: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizes = {
    sm: { num: "20px", label: "8px" },
    md: { num: "28px", label: "9px" },
    lg: { num: "40px", label: "10px" },
    xl: { num: "56px", label: "11px" },
  } as const;
  const s = sizes[size];

  return (
    <div className="flex flex-col items-start">
      <div
        className="leading-none font-feature-num"
        style={{
          fontFamily,
          fontWeight: 500,
          fontSize: s.num,
          letterSpacing: "-0.01em",
          whiteSpace: "nowrap",
        }}
      >
        {value}
        {unit && (
          <span style={{ fontSize: `calc(${s.num} * 0.55)`, marginLeft: 2, opacity: 0.7 }}>
            {unit}
          </span>
        )}
      </div>
      <div
        className="mt-1.5 uppercase"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: s.label,
          letterSpacing: "0.24em",
          opacity: 0.55,
        }}
      >
        {label}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * IngredientList — grouped list with deckle-style amounts
 * ───────────────────────────────────────────────────────────── */

export function IngredientList({
  recipe,
  amountWidth = 80,
  fontSize = "13.5px",
  spaceY = 4,
  bodyFamily,
}: {
  recipe: Recipe;
  amountWidth?: number;
  fontSize?: string;
  spaceY?: number;
  bodyFamily?: string;
}) {
  const groups = new Map<string, typeof recipe.ingredients>();
  for (const ing of recipe.ingredients) {
    const key = ing.group ?? "_default";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ing);
  }
  const entries = Array.from(groups.entries());

  return (
    <div className="space-y-4">
      {entries.map(([group, ings]) => (
        <div key={group}>
          {group !== "_default" && (
            <Eyebrow size="xs" className="mb-2 opacity-60">
              {group}
            </Eyebrow>
          )}
          <ul style={{ fontFamily: bodyFamily }}>
            {ings.map((ing, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: 0.2 + i * 0.018,
                  duration: 0.4,
                  ease: [0.22, 0.61, 0.36, 1],
                }}
                className="flex items-baseline"
                style={{
                  fontSize,
                  lineHeight: 1.55,
                  paddingTop: spaceY,
                  paddingBottom: spaceY,
                }}
              >
                <span
                  className="shrink-0 font-feature-num"
                  style={{
                    width: amountWidth,
                    color: "currentColor",
                    opacity: 0.7,
                    fontSize: "12.5px",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {ing.amount}
                  {ing.unit ? ` ${ing.unit}` : ""}
                </span>
                <span style={{ flex: 1 }}>{ing.name}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * StepList — numbered, animated, with leading rule
 * ───────────────────────────────────────────────────────────── */

export function StepList({
  recipe,
  bodyFamily,
  numberFamily,
  numberColor = "currentColor",
  numberStyle = "serif",
  fontSize = "13.5px",
}: {
  recipe: Recipe;
  bodyFamily?: string;
  numberFamily?: string;
  numberColor?: string;
  numberStyle?: "serif" | "mono" | "small";
  fontSize?: string;
}) {
  return (
    <ol style={{ fontFamily: bodyFamily }}>
      {recipe.steps.map((step, i) => (
        <motion.li
          key={step.index}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.32 + i * 0.045,
            duration: 0.5,
            ease: [0.22, 0.61, 0.36, 1],
          }}
          className="flex gap-4 py-2.5"
          style={{ fontSize, lineHeight: 1.55 }}
        >
          {numberStyle === "serif" ? (
            <span
              className="shrink-0 leading-none font-feature-num"
              style={{
                fontFamily: numberFamily,
                fontSize: "32px",
                fontWeight: 400,
                color: numberColor,
                width: 38,
                marginTop: -4,
                opacity: 0.85,
              }}
            >
              {String(step.index).padStart(2, "0")}
            </span>
          ) : numberStyle === "mono" ? (
            <span
              className="shrink-0 uppercase font-feature-num"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.22em",
                color: numberColor,
                width: 38,
                marginTop: 6,
              }}
            >
              {String(step.index).padStart(2, "0")}
            </span>
          ) : (
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-feature-num"
              style={{
                background: numberColor,
                color: "var(--color-paper)",
                fontSize: "11px",
                fontWeight: 600,
              }}
            >
              {step.index}
            </span>
          )}
          <span className="flex-1">{step.text}</span>
        </motion.li>
      ))}
    </ol>
  );
}

/* ─────────────────────────────────────────────────────────────
 * PhotoFrame — imageless or image-bearing surface, animated reveal
 * ───────────────────────────────────────────────────────────── */

export function PhotoFrame({
  imageUrl,
  imagePrompt,
  aspect = "4/5",
  className = "",
  style,
  borderColor = "currentColor",
  caption,
  motionDelay = 0.05,
}: {
  imageUrl?: string;
  imagePrompt?: string;
  aspect?: string;
  className?: string;
  style?: CSSProperties;
  borderColor?: string;
  caption?: string;
  motionDelay?: number;
}) {
  const transition: Transition = {
    duration: 0.7,
    delay: motionDelay,
    ease: [0.22, 0.61, 0.36, 1],
  };

  return (
    <div className={`relative ${className}`}>
      <motion.div
        initial={{ opacity: 0, scale: 1.02 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={transition}
        className="relative overflow-hidden"
        style={{ aspectRatio: aspect, ...style }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={imagePrompt ?? ""}
            className="h-full w-full object-cover"
          />
        ) : (
          <PhotoPlaceholder borderColor={borderColor} />
        )}
      </motion.div>
      {caption && (
        <motion.figcaption
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: motionDelay + 0.3, duration: 0.5 }}
          className="mt-2 italic"
          style={{
            fontFamily: "var(--font-fraunces)",
            fontSize: "11px",
            color: "currentColor",
            opacity: 0.6,
          }}
        >
          {caption}
        </motion.figcaption>
      )}
    </div>
  );
}

function PhotoPlaceholder({ borderColor }: { borderColor: string }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{
        background:
          "linear-gradient(135deg, currentColor 0%, transparent 70%), linear-gradient(45deg, transparent 50%, currentColor 100%)",
        backgroundBlendMode: "overlay",
        color: "rgba(26, 18, 11, 0.06)",
      }}
    >
      <div
        className="flex flex-col items-center gap-2 opacity-40"
        style={{ color: borderColor }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8">
          <rect x="2" y="4" width="20" height="16" rx="0.5" />
          <circle cx="8" cy="9" r="1.4" />
          <path d="M22 16.5L17 11.5C16.5 11 15.5 11 15 11.5L2 20" />
        </svg>
        <Eyebrow size="xs">Foto-Platzhalter</Eyebrow>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Signature — handwritten "Deine Biene 🐝"
 * ───────────────────────────────────────────────────────────── */

export function Signature({
  name,
  size = 22,
  motionDelay = 0.4,
}: {
  name?: string;
  size?: number;
  motionDelay?: number;
}) {
  if (!name) return null;
  return (
    <motion.span
      initial={{ opacity: 0, y: 4, rotate: -2 }}
      animate={{ opacity: 1, y: 0, rotate: -1.2 }}
      transition={{ delay: motionDelay, duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
      className="inline-block leading-none"
      style={{
        fontFamily: "var(--font-script)",
        fontWeight: 500,
        fontSize: size,
      }}
    >
      {name}
    </motion.span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Highlight chips — ✓-list compact
 * ───────────────────────────────────────────────────────────── */

export function HighlightChips({
  recipe,
  variant = "outline",
}: {
  recipe: Recipe;
  variant?: "outline" | "soft" | "underline";
}) {
  if (!recipe.highlights.length) return null;

  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-2">
      {recipe.highlights.map((h, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 + i * 0.04, duration: 0.4 }}
          className="inline-flex items-center gap-1.5 uppercase"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.18em",
            ...(variant === "outline" && {
              border: "0.5px solid currentColor",
              borderRadius: 999,
              padding: "3px 9px",
              opacity: 0.75,
            }),
            ...(variant === "soft" && {
              background: "currentColor",
              color: "var(--color-paper)",
              padding: "3px 9px",
              borderRadius: 2,
              opacity: 0.86,
            }),
            ...(variant === "underline" && {
              borderBottom: "0.5px solid currentColor",
              opacity: 0.7,
              paddingBottom: 1,
            }),
          }}
        >
          <CheckMark />
          {h}
        </motion.li>
      ))}
    </ul>
  );
}

function CheckMark() {
  return (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
      <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
 * useStaggerReveal — small helper for any motion entrance
 * ───────────────────────────────────────────────────────────── */

export const reveal = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
} as const;

export function delayed(
  delay: number,
  duration = 0.6,
  ease: [number, number, number, number] = [0.22, 0.61, 0.36, 1],
): Transition {
  return { delay, duration, ease };
}

export type MotionDivProps = HTMLMotionProps<"div">;
