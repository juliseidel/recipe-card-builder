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
  Hairline,
  HighlightChips,
  NumeralStack,
  delayed,
} from "./shared";

/**
 * THEME 01 · SWEET MORNINGS
 * Editorial Cookbook — Phaidon / Bon Appétit
 *
 * DNA:
 * - Massive serif title (Fraunces), drop-cap on description
 * - Hero photo top-right (4:5)
 * - Two-column body (ingredients | steps)
 * - Burgundy accent strip + honey gold numerals
 * - Slow, confident motion (mass = 0.9)
 */
export function EditorialCookbook({
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
      className="print-page paper-grain relative h-full w-full"
      style={{
        backgroundColor: theme.palette.paper,
        color: ink,
        fontFamily: theme.fonts.body,
      }}
    >
      {/* Wine masthead strip */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={delayed(0, 1.0)}
        className="absolute inset-x-0 top-0 origin-left"
        style={{ height: 4, background: acc }}
      />

      {/* Honey accent corner mark */}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={delayed(0.4, 0.6)}
        className="absolute right-12 top-12 h-2 w-2 rounded-full"
        style={{ background: theme.palette.highlight }}
        aria-hidden
      />

      <div className="grid h-full grid-cols-12 gap-x-10 px-14 pb-12 pt-16">
        {/* MASTHEAD */}
        <header className="col-span-12 mb-6">
          <motion.div {...{ initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 } }} transition={delayed(0.05)}>
            <Eyebrow size="sm" style={{ color: acc }}>
              {theme.name} · Recipe № {String(recipe.servings).padStart(2, "0")}
            </Eyebrow>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={delayed(0.1, 0.8)}
            className="mt-3 text-balance"
            style={{
              fontFamily: theme.fonts.display,
              fontSize: 78,
              fontWeight: 500,
              lineHeight: 0.92,
              letterSpacing: "-0.022em",
              color: ink,
            }}
          >
            {recipe.title}
          </motion.h1>

          {recipe.subtitle && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={delayed(0.3, 0.6)}
              className="mt-3 italic"
              style={{
                fontFamily: theme.fonts.display,
                fontSize: 22,
                fontWeight: 400,
                color: theme.palette.inkSoft,
                fontStyle: "italic",
              }}
            >
              {recipe.subtitle}
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={delayed(0.5)}
            className="mt-5"
          >
            <Hairline />
          </motion.div>
        </header>

        {/* LEFT: lead text + ingredients */}
        <div className="col-span-7 row-start-2 flex flex-col gap-7">
          {recipe.description && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={delayed(0.18, 0.7)}
              className="text-pretty"
              style={{
                fontSize: 16,
                lineHeight: 1.65,
                color: theme.palette.inkSoft,
                fontFamily: theme.fonts.body,
              }}
            >
              <span
                style={{
                  fontFamily: theme.fonts.display,
                  fontSize: 56,
                  fontWeight: 600,
                  lineHeight: 0.85,
                  float: "left",
                  color: acc,
                  marginRight: 8,
                  marginTop: 4,
                  marginBottom: -4,
                }}
              >
                {recipe.description.charAt(0)}
              </span>
              {recipe.description.slice(1)}
            </motion.p>
          )}

          <div>
            <Eyebrow size="md" className="mb-4" style={{ color: acc }}>
              Man nehme
            </Eyebrow>
            <IngredientList recipe={recipe} bodyFamily={theme.fonts.body} />
          </div>
        </div>

        {/* RIGHT: photo + nutrition */}
        <aside className="col-span-5 row-start-2 flex flex-col gap-6">
          <PhotoFrame
            imageUrl={recipe.imageUrl}
            imagePrompt={recipe.imagePrompt}
            aspect="4/5"
            motionDelay={0.15}
            style={{ background: theme.palette.paperDeep }}
          />

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={delayed(0.35)}
            className="flex justify-between gap-3 px-1 py-3"
            style={{
              borderTop: `0.5px solid ${theme.palette.hairline}`,
              borderBottom: `0.5px solid ${theme.palette.hairline}`,
            }}
          >
            <NumeralStack
              value={recipe.nutrition.kcal}
              label="kcal"
              fontFamily={theme.fonts.display}
              size="md"
            />
            <NumeralStack
              value={recipe.nutrition.protein}
              unit="g"
              label="Eiweiß"
              fontFamily={theme.fonts.display}
              size="md"
            />
            <NumeralStack
              value={recipe.nutrition.carbs}
              unit="g"
              label="Kohlenh."
              fontFamily={theme.fonts.display}
              size="md"
            />
            <NumeralStack
              value={recipe.nutrition.fat}
              unit="g"
              label="Fett"
              fontFamily={theme.fonts.display}
              size="md"
            />
          </motion.div>

          <HighlightChips recipe={recipe} variant="outline" />
        </aside>

        {/* STEPS — full-width band */}
        <section
          className="col-span-12 row-start-3 mt-10 grid grid-cols-12 gap-x-10"
          style={{
            borderTop: `0.5px solid ${theme.palette.hairline}`,
            paddingTop: 24,
          }}
        >
          <div className="col-span-3">
            <Eyebrow size="md" style={{ color: acc }}>
              Zubereitung
            </Eyebrow>
            <p
              className="mt-3 italic"
              style={{
                fontFamily: theme.fonts.display,
                fontSize: 13,
                color: theme.palette.inkMute,
                lineHeight: 1.5,
              }}
            >
              {recipe.totalMinutes ?? recipe.prepMinutes} Minuten ·{" "}
              {recipe.servings} Portionen
            </p>
          </div>
          <div className="col-span-9">
            <StepList
              recipe={recipe}
              bodyFamily={theme.fonts.body}
              numberFamily={theme.fonts.display}
              numberColor={acc}
              numberStyle="serif"
            />
          </div>
        </section>

        {/* FOOTER */}
        <footer className="col-span-12 row-start-4 mt-auto flex items-end justify-between pt-6">
          <div className="flex items-center gap-3">
            <Eyebrow size="xs" style={{ color: theme.palette.inkMute }}>
              bienesfitlife · {recipe.tags.slice(0, 2).join(" · ")}
            </Eyebrow>
          </div>
          <Signature name={recipe.signature} size={26} motionDelay={0.5} />
        </footer>
      </div>
    </article>
  );
}
