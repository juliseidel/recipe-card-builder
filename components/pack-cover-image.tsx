"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { Pack } from "@/lib/packs";
import { getCustomPack } from "@/lib/custom-packs";

type PackCoverImageProps = {
  pack: Pack;
  brandSlug: string;
  alt: string;
  sizes: string;
  /** When true, the polling kicks in for empty covers. Static curated packs
   *  always have a coverImage and pass false so we don't waste DB calls. */
  pollWhenEmpty: boolean;
};

// Renders the pack cover. For static packs that's just <Image>. For custom
// packs that haven't generated a cover yet, this polls Supabase every 4s
// until the AI hero arrives, then swaps in the real image with a soft fade.
//
// The skeleton mirrors the recipe-hero loading language (cream gradient +
// shimmer + breathing transform + caption) so users see one consistent
// "AI is rendering" state across the whole app.
export function PackCoverImage({
  pack,
  brandSlug,
  alt,
  sizes,
  pollWhenEmpty,
}: PackCoverImageProps) {
  const [coverImage, setCoverImage] = useState(pack.coverImage);

  useEffect(() => {
    if (!pollWhenEmpty) return;
    if (coverImage) return;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const poll = async () => {
      const fresh = await getCustomPack(brandSlug, pack.slug);
      if (!active) return;
      if (fresh?.coverImage) {
        setCoverImage(fresh.coverImage);
        return;
      }
      // Up to ~3 minutes. Flux usually lands in 15-25s but can stretch to 60s
      // under load — this gives us margin without polling forever.
      if (attempts++ < 45) {
        timer = setTimeout(poll, 4000);
      }
    };

    void poll();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [pollWhenEmpty, coverImage, brandSlug, pack.slug]);

  if (coverImage) {
    return (
      <Image
        src={coverImage}
        alt={alt}
        fill
        sizes={sizes}
        className="object-cover content-fade-in"
        priority
      />
    );
  }

  return <PackCoverSkeleton pack={pack} />;
}

function PackCoverSkeleton({ pack }: { pack: Pack }) {
  return (
    <div
      className="relative h-full w-full overflow-hidden hero-breathe"
      style={
        {
          background: `linear-gradient(135deg, ${pack.mood.background} 0%, ${pack.mood.accent}26 100%)`,
          "--shimmer-base": pack.mood.background,
          "--shimmer-glow": pack.mood.accent + "30",
        } as React.CSSProperties
      }
      aria-hidden
    >
      <div className="absolute inset-0 skeleton-shimmer" />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 30% 20%, transparent 30%, ${pack.mood.ink}1f 100%)`,
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <span
          className="size-2 rounded-full pending-dot"
          style={{ background: pack.mood.accent }}
        />
        <span
          className="font-display text-[20px] italic leading-tight"
          style={{ color: pack.mood.ink }}
        >
          Pack-Cover wird gestaltet
        </span>
        <span
          className="font-mono text-[10px] uppercase tracking-[0.2em]"
          style={{ color: pack.mood.inkSoft, opacity: 0.7 }}
        >
          Flux 2 Pro · ~30 Sek
        </span>
      </div>
    </div>
  );
}

// Compact variant for the workspace pack card. Same polling, smaller
// caption.
export function PackCardCoverImage({
  pack,
  brandSlug,
  alt,
  sizes,
  pollWhenEmpty,
}: PackCoverImageProps) {
  const [coverImage, setCoverImage] = useState(pack.coverImage);

  useEffect(() => {
    if (!pollWhenEmpty) return;
    if (coverImage) return;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const poll = async () => {
      const fresh = await getCustomPack(brandSlug, pack.slug);
      if (!active) return;
      if (fresh?.coverImage) {
        setCoverImage(fresh.coverImage);
        return;
      }
      if (attempts++ < 45) {
        timer = setTimeout(poll, 4000);
      }
    };

    void poll();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [pollWhenEmpty, coverImage, brandSlug, pack.slug]);

  if (coverImage) {
    return (
      <Image
        src={coverImage}
        alt={alt}
        fill
        sizes={sizes}
        className="object-cover content-fade-in transition-transform duration-300 ease-out group-hover:scale-[1.06]"
        priority
      />
    );
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={
        {
          background: `linear-gradient(135deg, ${pack.mood.background} 0%, ${pack.mood.accent}26 100%)`,
          "--shimmer-base": pack.mood.background,
          "--shimmer-glow": pack.mood.accent + "30",
        } as React.CSSProperties
      }
      aria-hidden
    >
      <div className="absolute inset-0 skeleton-shimmer" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-4 text-center">
        <span
          className="size-1.5 rounded-full pending-dot"
          style={{ background: pack.mood.accent }}
        />
        <span
          className="font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: pack.mood.ink }}
        >
          Cover wird gestaltet
        </span>
      </div>
    </div>
  );
}
