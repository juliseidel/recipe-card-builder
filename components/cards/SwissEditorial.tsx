"use client";

import type { Recipe } from "@/types/recipe";
import type { Theme } from "@/lib/themes";
import { motion } from "framer-motion";
import {
  Eyebrow,
  IngredientList,
  PhotoFrame,
  Signature,
  Hairline,
  delayed,
} from "./shared";

/**
 * THEME 02 · FIFTEEN MINUTES
 * Swiss Editorial — Kinfolk / Wallpaper
 *
 * DNA:
 * - Modular grid with visible rules
 * - Massive numeric anchor "0:15" as hero
 * - Sans-tight throughout, mono for meta
 * - Black ink, single amber pop
 * - Crisp, fast motion (no spring overshoot)
 */
export function SwissEditorial({
  recipe,
  theme,
}: {
  recipe: Recipe;
  theme: Theme;
}) {
  const ink = theme.palette.ink;
  const total = recipe.totalMinutes ?? recipe.prepMinutes;

  return (
    <article
      className="print-page relative h-full w-full"
      style={{
        backgroundColor: theme.palette.paper,
        color: ink,
        fontFamily: theme.fonts.body,
      }}
    >
      {/* Top rule with index */}
      <div className="absolute inset-x-12 top-12 flex items-center justify-between">
        <Eyebrow size="sm">
          № {String(recipe.servings).padStart(3, "0")} / Fifteen Minutes
        </Eyebrow>
        <Eyebrow size="sm" style={{ color: theme.palette.highlight }}>
          ⏱ Quick reference
        </Eyebrow>
      </div>

      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={delayed(0.05, 0.7)}
        className="absolute inset-x-12 top-20 origin-left"
        style={{ height: 0.5, background: ink, opacity: 0.4 }}
      />

      <div className="grid h-full grid-cols-12 grid-rows-[auto_auto_1fr_auto] gap-x-6 gap-y-5 px-12 pt-28 pb-12">
        {/* HERO ROW: title (8) + giant numeral (4) */}
        <div className="col-span-8 self-end">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={delayed(0.1, 0.7)}
            className="text-balance"
            style={{
              fontFamily: theme.fonts.display,
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 0.94,
              letterSpacing: "-0.024em",
            }}
          >
            {recipe.title}
          </motion.h1>
          {recipe.subtitle && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={delayed(0.25)}
              className="mt-3"
              style={{
                fontSize: 15,
                color: theme.palette.inkSoft,
                fontFamily: theme.fonts.body,
              }}
            >
              {recipe.subtitle}
            </motion.p>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={delayed(0.18, 0.6)}
          className="col-span-4 self-end pl-6"
          style={{ borderLeft: `1px solid ${theme.palette.hairline}` }}
        >
          <Eyebrow size="xs" className="mb-2 opacity-60">
            Zubereitungszeit
          </Eyebrow>
          <div
            className="font-feature-num"
            style={{
              fontFamily: theme.fonts.display,
              fontSize: 100,
              fontWeight: 700,
              lineHeight: 0.86,
              letterSpacing: "-0.05em",
              color: ink,
            }}
          >
            {String(Math.floor(total / 60)).padStart(1, "0")}:
            <span style={{ color: theme.palette.highlight }}>
              {String(total % 60).padStart(2, "0")}
            </span>
          </div>
          <Eyebrow size="xs" className="mt-1 opacity-60">
            Stunden : Minuten
          </Eyebrow>
        </motion.div>

        {/* META BAND (12) */}
        <div className="col-span-12 row-start-2 grid grid-cols-12 gap-x-6 py-3"
          style={{
            borderTop: `1px solid ${theme.palette.hairline}`,
            borderBottom: `1px solid ${theme.palette.hairline}`,
          }}
        >
          <Cell label="Portionen" value={String(recipe.servings)} family={theme.fonts.display} />
          <Cell label="kcal" value={String(recipe.nutrition.kcal)} family={theme.fonts.display} />
          <Cell label="Eiweiß" value={`${recipe.nutrition.protein}g`} family={theme.fonts.display} />
          <Cell label="KH" value={`${recipe.nutrition.carbs}g`} family={theme.fonts.display} />
          <Cell label="Fett" value={`${recipe.nutrition.fat}g`} family={theme.fonts.display} />
          <div className="col-span-2 flex flex-col justify-center" style={{ borderLeft: `1px solid ${theme.palette.hairline}` }}>
            <div className="pl-4">
              <Eyebrow size="xs" className="opacity-60">Schwierigkeit</Eyebrow>
              <p style={{ fontSize: 14, marginTop: 2, fontWeight: 500 }}>
                {recipe.difficulty === "easy" ? "Einfach" : recipe.difficulty === "medium" ? "Mittel" : recipe.difficulty === "hard" ? "Anspruchsvoll" : "Einfach"}
              </p>
            </div>
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="col-span-7 row-start-3 flex flex-col gap-5">
          <PhotoFrame
            imageUrl={recipe.imageUrl}
            imagePrompt={recipe.imagePrompt}
            aspect="3/2"
            motionDelay={0.2}
            caption={recipe.description ? `Fig. № ${String(recipe.servings).padStart(2, "0")} — ${recipe.title}` : undefined}
            style={{ background: theme.palette.paperDeep }}
          />
        </div>

        <div className="col-span-5 row-start-3 pl-6"
          style={{ borderLeft: `1px solid ${theme.palette.hairline}` }}
        >
          <Eyebrow size="md" className="mb-4">Was du brauchst</Eyebrow>
          <IngredientList recipe={recipe} bodyFamily={theme.fonts.body} amountWidth={68} fontSize="13px" />
        </div>

        {/* STEPS row */}
        <section className="col-span-12 row-start-4 mt-2 grid grid-cols-12 gap-x-6 pt-5"
          style={{ borderTop: `1px solid ${theme.palette.hairline}` }}
        >
          <div className="col-span-3">
            <Eyebrow size="md">Zubereitung</Eyebrow>
            <Hairline className="mt-3" />
          </div>
          <div className="col-span-9 grid grid-cols-2 gap-x-8">
            {recipe.steps.map((step, i) => (
              <motion.div
                key={step.index}
                initial={{ opacity: 0, x: 4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={delayed(0.32 + i * 0.04, 0.4)}
                className="border-t pt-3 pb-2"
                style={{ borderColor: theme.palette.hairline }}
              >
                <Eyebrow size="xs" style={{ color: theme.palette.highlight }}>
                  Schritt {String(step.index).padStart(2, "0")}
                </Eyebrow>
                <p
                  className="mt-2"
                  style={{
                    fontFamily: theme.fonts.body,
                    fontSize: 12.5,
                    lineHeight: 1.55,
                  }}
                >
                  {step.text}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* FOOTER */}
        <footer className="col-span-12 mt-6 flex items-end justify-between">
          <Eyebrow size="xs" style={{ opacity: 0.6 }}>
            @bienesfitlife · Wolf Family Office Edition
          </Eyebrow>
          <Signature name={recipe.signature} size={22} />
        </footer>
      </div>
    </article>
  );
}

function Cell({
  label,
  value,
  family,
}: {
  label: string;
  value: string;
  family: string;
}) {
  return (
    <div className="col-span-2">
      <Eyebrow size="xs" className="opacity-60">{label}</Eyebrow>
      <div
        className="mt-1 font-feature-num"
        style={{
          fontFamily: family,
          fontSize: 28,
          fontWeight: 600,
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
    </div>
  );
}
