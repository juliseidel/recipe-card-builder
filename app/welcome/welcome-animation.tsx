"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Welcome-Animation — 3.6 s cinematischer Brand-Moment. Kein Tool-Logo
// mehr (User-Feedback: das Stacked-Cards-Icon gefiel nicht). Stattdessen
// ist das Creator-Foto der visuelle Anker.
//
// Visuelles Konzept:
//   - Brand-Background (Cream bei Biene) mit langsam pulsierendem
//     Radial-Glow im Brand-Akzent (Honey)
//   - Avatar 220×220 rund, mit drei Glow-Layern (innerlich → außen
//     groesser + diffuser), pulsierender Brand-Ring
//   - Avatar reveal: clip-path-Circle wächst von 0 auf 100 %, scale
//     0.94 → 1.0, opacity 0 → 1 (gleichzeitig)
//   - Eyebrow "Willkommen zurück"
//   - Display-Name buchstabenweise gestaggered (jeder Char eigener
//     Slide+Fade — fühlt sich an wie type-on)
//   - Handle in Mono mit weiter Tracking
//   - Tagline italic Fraunces
//   - Progress-Bar mit Brand-Akzent → Signatur-Gradient
//   - Status "Studio öffnet…" als letzter Layer
//
// Reduced-Motion: alle Animationen werden uebersprungen, redirect
// nach 250 ms.

type Props = {
  displayName: string;
  handle: string;
  tagline: string;
  avatarUrl: string | null;
  brandTokens: {
    background: string;
    surface: string;
    ink: string;
    inkMuted: string;
    accent: string;
    accentSoft: string;
    line: string;
    signature: string;
  } | null;
  finalTarget: string;
};

const TOTAL_DURATION_MS = 3600;

export function WelcomeAnimation({
  displayName,
  handle,
  tagline,
  avatarUrl,
  brandTokens,
  finalTarget,
}: Props) {
  const router = useRouter();
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
  }, []);

  useEffect(() => {
    const delay = reducedMotion ? 250 : TOTAL_DURATION_MS;
    const timer = setTimeout(() => {
      router.push(finalTarget);
      router.refresh();
    }, delay);
    return () => clearTimeout(timer);
  }, [router, finalTarget, reducedMotion]);

  const bg = brandTokens?.background ?? "#fbf7f0";
  const ink = brandTokens?.ink ?? "#2b1f19";
  const inkSoft = brandTokens?.inkMuted ?? "#6b5444";
  const accent = brandTokens?.accent ?? "#e8889b";
  const accentSoft = brandTokens?.accentSoft ?? "#fde8ee";
  const signature = brandTokens?.signature ?? "#f4c44a";
  const surface = brandTokens?.surface ?? "#ffffff";

  const nameChars = Array.from(displayName);

  return (
    <main
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6"
      style={{ background: bg, color: ink }}
    >
      {/* Layer 1: ambient radial glow im Hintergrund. Gibt der Page
          Tiefe + atmet leicht (8 s loop). */}
      <div
        aria-hidden
        className="welcome-bg-glow pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 42%, ${accentSoft} 0%, transparent 60%)`,
        }}
      />

      {/* Layer 2: secondary accent-glow weiter unten — gibt der Page
          einen Lichtgradient von oben nach unten. */}
      <div
        aria-hidden
        className="welcome-bg-shine pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 50% 35% at 50% 70%, ${signature}28 0%, transparent 60%)`,
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-7 text-center">
        {/* Avatar mit gestapelten Glow-Layern */}
        <div className="welcome-avatar-wrap relative flex items-center justify-center">
          {/* Outer pulsing glow ring — am groessten + diffusesten */}
          <span
            aria-hidden
            className="welcome-glow-outer absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle, ${accent} 0%, transparent 65%)`,
              filter: "blur(28px)",
              transform: "scale(1.6)",
            }}
          />
          {/* Mid glow */}
          <span
            aria-hidden
            className="welcome-glow-mid absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle, ${signature} 0%, transparent 70%)`,
              filter: "blur(14px)",
              transform: "scale(1.25)",
              opacity: 0.55,
            }}
          />
          {/* Brand-Ring — solider Bogen direkt um den Avatar */}
          <span
            aria-hidden
            className="welcome-ring absolute inset-0 rounded-full"
            style={{
              border: `2px solid ${signature}`,
              transform: "scale(1.05)",
              boxShadow: `0 0 0 1px ${surface}, 0 22px 48px -16px ${ink}55`,
            }}
          />
          {/* Avatar-Image mit reveal */}
          <div
            className="welcome-avatar relative size-[220px] overflow-hidden rounded-full"
            style={{ background: surface }}
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                fill
                sizes="220px"
                className="object-cover"
                priority
              />
            ) : (
              <div
                className="flex size-full items-center justify-center font-display text-[80px]"
                style={{ color: ink }}
              >
                {displayName.charAt(0)}
              </div>
            )}
          </div>
        </div>

        {/* Eyebrow */}
        <p
          className="welcome-eyebrow font-mono text-[11px] font-semibold uppercase tracking-[0.32em]"
          style={{ color: inkSoft }}
        >
          Willkommen zurück
        </p>

        {/* Creator-Name mit per-Buchstaben Stagger */}
        <h1
          className="welcome-name font-display text-[68px] font-normal leading-[0.94] tracking-[-0.025em] sm:text-[88px]"
          style={{ color: ink }}
          aria-label={displayName}
        >
          {nameChars.map((char, i) => (
            <span
              key={i}
              className="welcome-name-char inline-block"
              style={{
                animationDelay: `${1300 + i * 55}ms`,
                whiteSpace: char === " " ? "pre" : undefined,
              }}
              aria-hidden
            >
              {char === " " ? " " : char}
            </span>
          ))}
        </h1>

        {/* Handle + Tagline */}
        <div className="welcome-meta flex flex-col items-center gap-2">
          {handle ? (
            <p
              className="font-mono text-[12px] uppercase tracking-[0.22em]"
              style={{ color: inkSoft }}
            >
              {handle}
            </p>
          ) : null}
          {tagline ? (
            <p
              className="font-display text-[16px] italic leading-relaxed"
              style={{ color: inkSoft, fontStyle: "italic" }}
            >
              „{tagline}"
            </p>
          ) : null}
        </div>

        {/* Progress + Status */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <div
            className="welcome-progress-track h-[3px] w-[300px] overflow-hidden rounded-full"
            style={{ background: `${ink}14` }}
          >
            <div
              className="welcome-progress-fill h-full"
              style={{
                background: `linear-gradient(90deg, ${accent}, ${signature})`,
              }}
            />
          </div>
          <p
            className="welcome-status text-[12.5px]"
            style={{ color: inkSoft }}
          >
            Studio öffnet…
          </p>
        </div>
      </div>

      <style jsx>{`
        /* Background glow & shine */
        @keyframes bgGlowPulse {
          0%,
          100% {
            opacity: 0.85;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.04);
          }
        }
        @keyframes bgShineDrift {
          0%,
          100% {
            opacity: 0.7;
            transform: translateY(0);
          }
          50% {
            opacity: 1;
            transform: translateY(-12px);
          }
        }
        .welcome-bg-glow {
          animation: bgGlowPulse 9s ease-in-out infinite;
        }
        .welcome-bg-shine {
          animation: bgShineDrift 11s ease-in-out infinite;
        }

        /* Avatar reveal */
        @keyframes avatarReveal {
          0% {
            opacity: 0;
            transform: scale(0.9);
            clip-path: circle(0% at 50% 50%);
          }
          100% {
            opacity: 1;
            transform: scale(1);
            clip-path: circle(100% at 50% 50%);
          }
        }
        .welcome-avatar-wrap {
          width: 220px;
          height: 220px;
        }
        .welcome-avatar {
          opacity: 0;
          animation: avatarReveal 0.85s cubic-bezier(0.22, 1, 0.36, 1) 220ms
            forwards;
        }
        @keyframes glowFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes glowPulseOuter {
          0%,
          100% {
            opacity: 0.4;
            transform: scale(1.6);
          }
          50% {
            opacity: 0.65;
            transform: scale(1.7);
          }
        }
        @keyframes glowPulseMid {
          0%,
          100% {
            opacity: 0.45;
            transform: scale(1.25);
          }
          50% {
            opacity: 0.65;
            transform: scale(1.32);
          }
        }
        @keyframes ringFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1.05);
          }
        }
        .welcome-glow-outer {
          opacity: 0;
          animation:
            glowFadeIn 0.6s ease-out 320ms forwards,
            glowPulseOuter 4s ease-in-out 1.2s infinite;
        }
        .welcome-glow-mid {
          opacity: 0;
          animation:
            glowFadeIn 0.6s ease-out 420ms forwards,
            glowPulseMid 3.4s ease-in-out 1.4s infinite;
        }
        .welcome-ring {
          opacity: 0;
          animation: ringFadeIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) 600ms
            forwards;
        }

        /* Eyebrow */
        @keyframes textIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .welcome-eyebrow {
          opacity: 0;
          animation: textIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) 1100ms
            forwards;
        }

        /* Per-character name stagger */
        @keyframes charIn {
          from {
            opacity: 0;
            transform: translateY(28px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .welcome-name-char {
          opacity: 0;
          animation: charIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        /* Meta — handle + tagline */
        .welcome-meta {
          opacity: 0;
          animation: textIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) 2050ms
            forwards;
        }

        /* Progress + status */
        @keyframes progressFill {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .welcome-progress-track {
          opacity: 0;
          animation: textIn 0.4s ease-out 2500ms forwards;
        }
        .welcome-progress-fill {
          transform: translateX(-100%);
          animation: progressFill 0.95s cubic-bezier(0.65, 0, 0.35, 1)
            2700ms forwards;
        }
        .welcome-status {
          opacity: 0;
          animation: textIn 0.5s ease-out 3000ms forwards;
        }

        /* Reduced motion: skip everything, just show the result */
        @media (prefers-reduced-motion: reduce) {
          .welcome-bg-glow,
          .welcome-bg-shine,
          .welcome-glow-outer,
          .welcome-glow-mid,
          .welcome-ring,
          .welcome-avatar,
          .welcome-eyebrow,
          .welcome-name-char,
          .welcome-meta,
          .welcome-progress-track,
          .welcome-status {
            opacity: 1;
            transform: none;
            clip-path: none;
            animation: none;
          }
          .welcome-progress-fill {
            transform: translateX(0);
            animation: none;
          }
          .welcome-glow-outer {
            transform: scale(1.6);
          }
          .welcome-glow-mid {
            transform: scale(1.25);
          }
          .welcome-ring {
            transform: scale(1.05);
          }
        }
      `}</style>
    </main>
  );
}
