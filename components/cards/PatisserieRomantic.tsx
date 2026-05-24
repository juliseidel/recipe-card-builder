"use client";

import type { Recipe } from "@/types/recipe";
import type { Theme } from "@/lib/themes";
import { motion } from "framer-motion";
import {
  Eyebrow,
  IngredientList,
  StepList,
  PhotoFrame,
  Signature,
  delayed,
} from "./shared";

/**
 * THEME 03 · COZY SWEET TREATS
 * Patisserie Romantic — Cédric Grolet / Ladurée
 *
 * DNA:
 * - Centered classical book page
 * - Cormorant italic display, Baskerville body (all serif)
 * - Decorative fleurons, inner border, antique gold
 * - Rose-tinted cream paper
 * - Slow, organic spring motion (mass = 1.1)
 */
export function PatisserieRomantic({
  recipe,
  theme,
}: {
  recipe: Recipe;
  theme: Theme;
}) {
  const acc = theme.palette.accent;
  const ink = theme.palette.ink;

  return (
    <article
      className="print-page paper-grain-soft relative h-full w-full"
      style={{
        backgroundColor: theme.palette.paper,
        color: ink,
        fontFamily: theme.fonts.body,
      }}
    >
      {/* Inner decorative border */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={delayed(0.2, 1.0)}
        className="pointer-events-none absolute inset-7 rounded-[2px]"
        style={{ border: `0.5px solid ${acc}` }}
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.18 }}
        transition={delayed(0.3, 1.0)}
        className="pointer-events-none absolute inset-9 rounded-[2px]"
        style={{ border: `0.5px solid ${acc}` }}
      />

      <div className="relative grid h-full grid-cols-12 gap-x-6 px-20 py-20">
        {/* HEADER — centered crest */}
        <header className="col-span-12 mb-6 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={delayed(0.1)}
            className="flex items-center gap-3"
          >
            <Fleuron color={acc} flip />
            <Eyebrow size="xs" style={{ color: theme.palette.inkSoft, letterSpacing: "0.5em" }}>
              Cozy Sweet Treats
            </Eyebrow>
            <Fleuron color={acc} />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 8, letterSpacing: "0em" }}
            animate={{ opacity: 1, y: 0, letterSpacing: "-0.018em" }}
            transition={delayed(0.18, 0.9)}
            className="mt-5 max-w-[560px] text-balance"
            style={{
              fontFamily: theme.fonts.display,
              fontSize: 78,
              fontWeight: 400,
              fontStyle: "italic",
              lineHeight: 0.96,
              color: ink,
            }}
          >
            {recipe.title}
          </motion.h1>

          {recipe.subtitle && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={delayed(0.45)}
              className="mt-3 italic"
              style={{
                fontFamily: theme.fonts.script,
                fontSize: 28,
                color: acc,
              }}
            >
              {recipe.subtitle}
            </motion.p>
          )}

          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 80 }}
            transition={delayed(0.55, 0.7)}
            className="mt-6"
            style={{ height: 0.5, background: acc, opacity: 0.6 }}
          />
        </header>

        {/* HERO PHOTO */}
        <motion.div
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={delayed(0.25, 0.9)}
          className="col-span-12"
        >
          <PhotoFrame
            imageUrl={recipe.imageUrl}
            imagePrompt={recipe.imagePrompt}
            aspect="16/7"
            motionDelay={0.25}
            style={{ background: theme.palette.paperDeep }}
            caption={
              recipe.description
                ? `« ${recipe.description.slice(0, 92)}${recipe.description.length > 92 ? "…" : ""} »`
                : undefined
            }
          />
        </motion.div>

        {/* INGREDIENTS (5) | STEPS (7) */}
        <div className="col-span-5 mt-6">
          <h3
            className="mb-4"
            style={{
              fontFamily: theme.fonts.display,
              fontSize: 22,
              fontStyle: "italic",
              fontWeight: 500,
              color: acc,
            }}
          >
            Was hinein gehört
          </h3>
          <IngredientList recipe={recipe} bodyFamily={theme.fonts.body} fontSize="13px" amountWidth={68} />
        </div>

        <div className="col-span-7 mt-6 pl-8" style={{ borderLeft: `0.5px solid ${theme.palette.hairline}` }}>
          <h3
            className="mb-4"
            style={{
              fontFamily: theme.fonts.display,
              fontSize: 22,
              fontStyle: "italic",
              fontWeight: 500,
              color: acc,
            }}
          >
            So machst du es
          </h3>
          <StepList
            recipe={recipe}
            bodyFamily={theme.fonts.body}
            numberFamily={theme.fonts.display}
            numberColor={acc}
            numberStyle="serif"
            fontSize="12.5px"
          />
        </div>

        {/* MACROS — antique panel */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={delayed(0.5)}
          className="col-span-12 mt-8 flex items-center justify-between gap-6 px-6 py-4"
          style={{
            borderTop: `0.5px solid ${theme.palette.hairline}`,
            borderBottom: `0.5px solid ${theme.palette.hairline}`,
          }}
        >
          <Eyebrow size="xs" style={{ color: acc, letterSpacing: "0.4em" }}>Pro Stück</Eyebrow>
          <div className="flex items-baseline gap-8">
            {[
              [recipe.nutrition.kcal, "kcal"],
              [`${recipe.nutrition.protein}g`, "Eiweiß"],
              [`${recipe.nutrition.carbs}g`, "Kohlenh."],
              [`${recipe.nutrition.fat}g`, "Fett"],
            ].map(([v, l], i) => (
              <div key={i} className="flex items-baseline gap-2">
                <span
                  className="font-feature-num"
                  style={{
                    fontFamily: theme.fonts.display,
                    fontSize: 26,
                    fontStyle: "italic",
                    fontWeight: 600,
                    color: ink,
                  }}
                >
                  {v}
                </span>
                <Eyebrow size="xs" style={{ color: theme.palette.inkSoft }}>{l}</Eyebrow>
              </div>
            ))}
          </div>
        </motion.div>

        {/* SIGNATURE */}
        <footer className="col-span-12 mt-auto flex items-end justify-between pt-6">
          <p
            className="max-w-md italic"
            style={{
              fontFamily: theme.fonts.script,
              color: theme.palette.inkSoft,
              fontSize: 18,
              lineHeight: 1.4,
            }}
          >
            {recipe.notes ?? "Ein Lieblings-Klassiker aus meiner Backstube."}
          </p>
          <div className="text-right">
            <Eyebrow size="xs" style={{ color: theme.palette.inkSoft, letterSpacing: "0.4em" }}>
              bienesfitlife
            </Eyebrow>
            <div className="mt-2">
              <Signature name={recipe.signature} size={28} motionDelay={0.55} />
            </div>
          </div>
        </footer>
      </div>
    </article>
  );
}

function Fleuron({ color, flip = false }: { color: string; flip?: boolean }) {
  return (
    <svg
      width="44"
      height="14"
      viewBox="0 0 44 14"
      fill="none"
      style={{ transform: flip ? "scaleX(-1)" : undefined, color }}
      aria-hidden
    >
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={delayed(0.2, 1.4)}
        d="M0 7 Q 8 7 14 5 Q 18 3 22 4 L 22 5 L 26 5 Q 30 4 36 6 Q 42 8 44 7"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="22" cy="6" r="1.4" fill="currentColor" opacity="0.85" />
      <circle cx="6" cy="6.5" r="0.8" fill="currentColor" opacity="0.6" />
      <circle cx="38" cy="6.5" r="0.8" fill="currentColor" opacity="0.6" />
    </svg>
  );
}
