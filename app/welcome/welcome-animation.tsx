"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RecipeCardLogo } from "@/components/logo";

// Welcome-Animation — ~2.6 s gesamt:
//
//   t=0     ms  Logo fade+scale-in von 0.85 → 1.0
//   t=350   ms  "Willkommen zurück" Eyebrow slide+fade-in von y=8
//   t=650   ms  Creator-Name (display) slide+fade-in von y=14
//   t=1100  ms  Handle subtitle fade-in
//   t=1500  ms  Progress-Strip startet (animiert auf 100% in 900ms)
//   t=2400  ms  Subtle "öffne dein Studio…" Status-Text fade-in
//   t=2600  ms  Push zum Brand-Workspace
//
// Brand-tokens steuern den Hintergrund-Tint. Bienes Cream-Base bleibt
// angekert; das Akzent-Honey landet in der Progress-Bar. Wenn keine
// Brand-Tokens da sind (User ohne metadata), fallen wir auf neutrale
// canvas/ink-Werte zurück.
//
// Reduced-motion: respektieren wir, indem die Animation komplett
// übersprungen wird und der redirect nach 200 ms läuft.

type Props = {
  displayName: string;
  handle: string;
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

export function WelcomeAnimation({
  displayName,
  handle,
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
    const delay = reducedMotion ? 200 : 2600;
    const timer = setTimeout(() => {
      router.push(finalTarget);
      router.refresh();
    }, delay);
    return () => clearTimeout(timer);
  }, [router, finalTarget, reducedMotion]);

  const bg = brandTokens?.background ?? "#fbf7f0";
  const ink = brandTokens?.ink ?? "#2b1f19";
  const inkSoft = brandTokens?.inkMuted ?? "#6b5444";
  const accent = brandTokens?.accent ?? "#f4c44a";
  const accentSoft = brandTokens?.accentSoft ?? "#fde8ee";
  const signature = brandTokens?.signature ?? "#f4c44a";

  return (
    <main
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6"
      style={{ background: bg, color: ink }}
    >
      {/* Soft radial glow im Hintergrund — gibt der Page Tiefe ohne von
          der Typografie abzulenken. Pulst leicht (8s loop), damit sich
          die Page nie "gefroren" anfühlt. */}
      <div
        aria-hidden
        className="welcome-glow pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 38%, ${accentSoft} 0%, transparent 65%)`,
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-7 text-center">
        {/* Logo */}
        <span
          className="welcome-logo inline-flex size-14 items-center justify-center"
          aria-hidden
        >
          <RecipeCardLogo size={56} />
        </span>

        {/* Eyebrow */}
        <p
          className="welcome-eyebrow font-mono text-[10.5px] font-semibold uppercase tracking-[0.28em]"
          style={{ color: inkSoft }}
        >
          Willkommen zurück
        </p>

        {/* Creator-Name */}
        <h1
          className="welcome-name font-display text-[64px] font-normal leading-[0.95] tracking-[-0.025em] sm:text-[80px]"
          style={{ color: ink }}
        >
          {displayName}
        </h1>

        {/* Handle */}
        {handle ? (
          <p
            className="welcome-handle font-mono text-[12px] uppercase tracking-[0.18em]"
            style={{ color: inkSoft }}
          >
            {handle}
          </p>
        ) : null}

        {/* Progress-Strip */}
        <div
          className="welcome-progress-track mt-8 h-[3px] w-[260px] overflow-hidden rounded-full"
          style={{ background: `${ink}14` }}
        >
          <div
            className="welcome-progress-fill h-full"
            style={{
              background: `linear-gradient(90deg, ${accent}, ${signature})`,
            }}
          />
        </div>

        {/* Status */}
        <p
          className="welcome-status text-[13px] leading-relaxed"
          style={{ color: inkSoft }}
        >
          Studio öffnet…
        </p>
      </div>

      <style jsx>{`
        @keyframes welcomeLogoIn {
          from {
            opacity: 0;
            transform: scale(0.85) translateY(-8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes welcomeEyebrowIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes welcomeNameIn {
          from {
            opacity: 0;
            transform: translateY(14px);
            letter-spacing: 0.01em;
          }
          to {
            opacity: 1;
            transform: translateY(0);
            letter-spacing: -0.025em;
          }
        }
        @keyframes welcomeHandleIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes welcomeProgressFill {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
        @keyframes welcomeStatusIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 0.9;
            transform: translateY(0);
          }
        }
        @keyframes welcomeGlowPulse {
          0%,
          100% {
            opacity: 0.85;
          }
          50% {
            opacity: 1;
          }
        }
        .welcome-glow {
          animation: welcomeGlowPulse 8s ease-in-out infinite;
        }
        .welcome-logo {
          opacity: 0;
          animation: welcomeLogoIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0ms
            forwards;
        }
        .welcome-eyebrow {
          opacity: 0;
          animation: welcomeEyebrowIn 0.5s cubic-bezier(0.22, 1, 0.36, 1)
            350ms forwards;
        }
        .welcome-name {
          opacity: 0;
          animation: welcomeNameIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) 650ms
            forwards;
        }
        .welcome-handle {
          opacity: 0;
          animation: welcomeHandleIn 0.5s ease-out 1100ms forwards;
        }
        .welcome-progress-track {
          opacity: 0;
          animation: welcomeHandleIn 0.4s ease-out 1400ms forwards;
        }
        .welcome-progress-fill {
          transform: translateX(-100%);
          animation: welcomeProgressFill 1s cubic-bezier(0.65, 0, 0.35, 1)
            1500ms forwards;
        }
        .welcome-status {
          opacity: 0;
          animation: welcomeStatusIn 0.5s ease-out 2200ms forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .welcome-logo,
          .welcome-eyebrow,
          .welcome-name,
          .welcome-handle,
          .welcome-progress-track,
          .welcome-status {
            opacity: 1;
            transform: none;
            animation: none;
          }
          .welcome-progress-fill {
            transform: translateX(0);
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}
