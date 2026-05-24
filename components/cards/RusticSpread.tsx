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
  HighlightChips,
  delayed,
} from "./shared";

/**
 * THEME 04 · HEARTY BITES
 * Rustic Spread — Sam Sifton / Jamie Oliver
 *
 * DNA:
 * - Calistoga warm display (chunky, hand-cut feel)
 * - Cinemascope hero (21:9) on the right
 * - Asymmetric: text left, photo right, full-bleed
 * - Espresso ink, sage accents
 * - Photo enters from the right with confident speed
 */
export function RusticSpread({ recipe, theme }: { recipe: Recipe; theme: Theme }) {
  const acc = theme.palette.accent;
  const sage = theme.palette.highlight;
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
      {/* Sage corner block */}
      <motion.div
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={delayed(0.1, 0.8)}
        className="absolute top-0 left-0 origin-top"
        style={{ width: 5, height: "100%", background: sage, opacity: 0.5 }}
      />

      <div className="grid h-full grid-cols-12 gap-x-8 px-14 pb-12 pt-14">
        {/* CHAPTER TAG */}
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={delayed(0.05)}
          className="col-span-12 flex items-center gap-3"
        >
          <span
            className="px-2.5 py-1 uppercase"
            style={{
              background: acc,
              color: theme.palette.paper,
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
              fontSize: 10,
              letterSpacing: "0.32em",
              borderRadius: 1,
            }}
          >
            Hearty · Klassiker
          </span>
          <Eyebrow size="xs" style={{ color: theme.palette.inkMute }}>
            Recipe № {String(recipe.servings).padStart(2, "0")} / {recipe.tags.slice(0, 1)[0] ?? "Hauptgericht"}
          </Eyebrow>
        </motion.div>

        {/* TITLE — left aligned, Calistoga */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={delayed(0.15, 0.8)}
          className="col-span-12 mt-3 max-w-[750px] text-balance"
          style={{
            fontFamily: theme.fonts.display,
            fontSize: 84,
            fontWeight: 400,
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
            transition={delayed(0.32)}
            className="col-span-12 mt-3"
            style={{
              fontSize: 17,
              fontWeight: 400,
              color: theme.palette.inkSoft,
            }}
          >
            {recipe.subtitle}
          </motion.p>
        )}

        {/* CINEMASCOPE PHOTO + DESCRIPTION */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={delayed(0.25, 0.9)}
          className="col-span-12 mt-6"
        >
          <PhotoFrame
            imageUrl={recipe.imageUrl}
            imagePrompt={recipe.imagePrompt}
            aspect="21/8"
            motionDelay={0.25}
            style={{ background: theme.palette.paperDeep }}
          />
        </motion.div>

        {/* ROW: meta strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={delayed(0.4)}
          className="col-span-12 mt-5 flex items-center justify-between gap-4 py-3"
          style={{
            borderTop: `1px solid ${theme.palette.hairline}`,
            borderBottom: `1px solid ${theme.palette.hairline}`,
          }}
        >
          <div className="flex items-center gap-7">
            {[
              ["Total", `${recipe.totalMinutes ?? recipe.prepMinutes} Min.`],
              ["Portionen", String(recipe.servings)],
              ["Schwierigkeit", recipe.difficulty === "easy" ? "Einfach" : recipe.difficulty === "medium" ? "Mittel" : recipe.difficulty === "hard" ? "Anspruchsvoll" : "Einfach"],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col">
                <Eyebrow size="xs" style={{ opacity: 0.55 }}>
                  {label}
                </Eyebrow>
                <span style={{ fontSize: 15, fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>

          <div className="flex items-baseline gap-6">
            {[
              [recipe.nutrition.kcal, "kcal"],
              [`${recipe.nutrition.protein}g`, "Eiweiß"],
              [`${recipe.nutrition.carbs}g`, "KH"],
              [`${recipe.nutrition.fat}g`, "Fett"],
            ].map(([v, l], i) => (
              <div key={i} className="flex items-baseline gap-1.5">
                <span
                  className="font-feature-num"
                  style={{
                    fontFamily: theme.fonts.display,
                    fontSize: 22,
                    color: ink,
                  }}
                >
                  {v}
                </span>
                <Eyebrow size="xs" style={{ opacity: 0.5 }}>{l}</Eyebrow>
              </div>
            ))}
          </div>
        </motion.div>

        {/* INGREDIENTS (4) | STEPS (8) */}
        <aside className="col-span-4 mt-7 self-start">
          <div
            className="rounded-sm p-6"
            style={{
              background: theme.palette.paperVeil,
              border: `0.5px solid ${theme.palette.hairline}`,
            }}
          >
            <Eyebrow size="md" className="mb-4" style={{ color: acc }}>
              Vorratskammer
            </Eyebrow>
            <IngredientList recipe={recipe} bodyFamily={theme.fonts.body} fontSize="12.5px" amountWidth={64} />

            {recipe.highlights.length > 0 && (
              <div className="mt-5 pt-4" style={{ borderTop: `0.5px solid ${theme.palette.hairline}` }}>
                <HighlightChips recipe={recipe} variant="underline" />
              </div>
            )}
          </div>
        </aside>

        <section className="col-span-8 mt-7">
          <Eyebrow size="md" className="mb-4" style={{ color: acc }}>
            So gehst du vor
          </Eyebrow>
          <StepList
            recipe={recipe}
            bodyFamily={theme.fonts.body}
            numberFamily={theme.fonts.display}
            numberColor={sage}
            numberStyle="serif"
            fontSize="13.5px"
          />

          {recipe.notes && (
            <motion.div
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={delayed(0.6)}
              className="mt-6 rounded-sm p-5"
              style={{
                background: theme.palette.accentSoft,
                color: theme.palette.accentDeep,
              }}
            >
              <Eyebrow size="xs" className="mb-2" style={{ color: theme.palette.accentDeep }}>
                Bienen-Tipp
              </Eyebrow>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, fontStyle: "italic" }}>
                {recipe.notes}
              </p>
            </motion.div>
          )}
        </section>

        {/* FOOTER */}
        <footer className="col-span-12 mt-auto flex items-end justify-between pt-6">
          <Eyebrow size="xs" style={{ color: theme.palette.inkMute }}>
            bienesfitlife · {recipe.tags.slice(0, 3).join(" · ")}
          </Eyebrow>
          <Signature name={recipe.signature} size={26} motionDelay={0.55} />
        </footer>
      </div>
    </article>
  );
}
