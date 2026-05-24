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
 * THEME 05 · MEAL PREP SUNDAY
 * Modern Planner — Field Notes / Hermès Agenda
 *
 * DNA:
 * - Tab-marker on top edge with day stamp
 * - Tabular layout, monospaced data
 * - Mustard gold accent
 * - Inter Tight display + JetBrains Mono numerals
 * - Crisp, fast spring (no overshoot, planner-precise)
 */
export function ModernPlanner({ recipe, theme }: { recipe: Recipe; theme: Theme }) {
  const acc = theme.palette.accent;
  const gold = theme.palette.highlight;
  const ink = theme.palette.ink;

  return (
    <article
      className="print-page relative h-full w-full"
      style={{
        backgroundColor: theme.palette.paper,
        color: ink,
        fontFamily: theme.fonts.body,
      }}
    >
      {/* Tab marker top */}
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={delayed(0.05, 0.7)}
        className="absolute left-12 top-0 flex items-end gap-3 px-5 py-2"
        style={{
          background: acc,
          color: theme.palette.paper,
          borderRadius: "0 0 4px 4px",
        }}
      >
        <Eyebrow size="xs" style={{ color: theme.palette.paper, letterSpacing: "0.32em" }}>
          № {String(recipe.servings).padStart(3, "0")}
        </Eyebrow>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", opacity: 0.7 }}>
          MEAL PREP / SUNDAY
        </span>
      </motion.div>

      {/* Gold corner pin */}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={delayed(0.4, 0.5)}
        className="absolute top-12 right-12 h-3 w-3"
        style={{ background: gold, transform: "rotate(45deg)" }}
        aria-hidden
      />

      <div className="grid h-full grid-cols-12 grid-rows-[auto_auto_1fr_auto] gap-x-6 px-12 pt-20 pb-12">
        {/* TITLE */}
        <header className="col-span-12">
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={delayed(0.15, 0.7)}
            className="text-balance"
            style={{
              fontFamily: theme.fonts.display,
              fontSize: 56,
              fontWeight: 700,
              lineHeight: 0.95,
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
              transition={delayed(0.3)}
              className="mt-2"
              style={{
                fontSize: 14,
                color: theme.palette.inkSoft,
              }}
            >
              {recipe.subtitle}
            </motion.p>
          )}

          {recipe.description && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={delayed(0.4)}
              className="mt-4 max-w-[440px] text-pretty"
              style={{
                fontSize: 13.5,
                lineHeight: 1.6,
                color: theme.palette.inkSoft,
              }}
            >
              {recipe.description}
            </motion.p>
          )}
        </header>

        {/* TABULAR DATA STRIP */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={delayed(0.45, 0.5)}
          className="col-span-12 mt-7"
          style={{
            borderTop: `1px solid ${ink}`,
            borderBottom: `1px solid ${ink}`,
          }}
        >
          <table className="w-full">
            <thead>
              <tr>
                {["Nährwert", "Menge", "Pro Portion", "Tageswert"].map((h, i) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left"
                    style={{
                      borderBottom: `0.5px solid ${theme.palette.hairline}`,
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                      color: theme.palette.inkSoft,
                      width: i === 0 ? "30%" : "auto",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Energie", `${recipe.nutrition.kcal} kcal`, recipe.nutrition.kcal, Math.round((recipe.nutrition.kcal / 2000) * 100)],
                ["Eiweiß", `${recipe.nutrition.protein} g`, recipe.nutrition.protein, Math.round((recipe.nutrition.protein / 50) * 100)],
                ["Kohlenhydrate", `${recipe.nutrition.carbs} g`, recipe.nutrition.carbs, Math.round((recipe.nutrition.carbs / 260) * 100)],
                ["Fett", `${recipe.nutrition.fat} g`, recipe.nutrition.fat, Math.round((recipe.nutrition.fat / 70) * 100)],
              ].map(([label, val, num, daily]) => (
                <tr key={String(label)}>
                  <td className="px-3 py-2" style={{ fontSize: 12.5, color: ink }}>
                    {label}
                  </td>
                  <td className="px-3 py-2 font-feature-num" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: ink }}>
                    {val}
                  </td>
                  <td className="px-3 py-2 font-feature-num" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: theme.palette.inkSoft }}>
                    {num}
                  </td>
                  <td className="px-3 py-2 font-feature-num" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: gold }}>
                    {daily}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {/* MAIN ROW */}
        <div className="col-span-7 row-start-3 mt-6">
          <PhotoFrame
            imageUrl={recipe.imageUrl}
            imagePrompt={recipe.imagePrompt}
            aspect="4/3"
            motionDelay={0.5}
            style={{ background: theme.palette.paperDeep, borderRadius: 4 }}
          />
        </div>

        <div className="col-span-5 row-start-3 mt-6 pl-6"
          style={{ borderLeft: `1px solid ${theme.palette.hairline}` }}
        >
          <Eyebrow size="md" className="mb-3" style={{ color: acc }}>
            Einkaufsliste
          </Eyebrow>
          <IngredientList recipe={recipe} bodyFamily={theme.fonts.body} fontSize="12px" amountWidth={62} spaceY={2} />
        </div>

        {/* STEPS row */}
        <section className="col-span-12 row-start-4 mt-7 pt-5 grid grid-cols-12 gap-x-6"
          style={{ borderTop: `1px solid ${theme.palette.hairline}` }}
        >
          <div className="col-span-3">
            <Eyebrow size="md" style={{ color: acc }}>
              Ablauf
            </Eyebrow>
            <p
              className="mt-2 font-feature-num"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: theme.palette.inkSoft,
                letterSpacing: "0.1em",
              }}
            >
              {String(recipe.steps.length).padStart(2, "0")} Schritte ·{" "}
              {recipe.totalMinutes ?? recipe.prepMinutes} min
            </p>
          </div>
          <div className="col-span-9">
            <StepList
              recipe={recipe}
              bodyFamily={theme.fonts.body}
              numberFamily="var(--font-mono)"
              numberColor={gold}
              numberStyle="mono"
              fontSize="12.5px"
            />
          </div>
        </section>

        {/* FOOTER */}
        <footer className="col-span-12 mt-auto flex items-end justify-between pt-5">
          <div className="flex items-center gap-3">
            <Eyebrow size="xs" style={{ color: theme.palette.inkMute }}>
              bienesfitlife · Wolf Family Office
            </Eyebrow>
          </div>
          <Signature name={recipe.signature} size={22} motionDelay={0.6} />
        </footer>
      </div>
    </article>
  );
}
