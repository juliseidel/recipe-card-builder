import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import { PdfExportButton } from "./pdf-export-button";
import { PackDeleteButton } from "./pack-delete-button";
import { PackCoverRerollButton } from "./pack-cover-reroll-button";

type PackActionsProps = {
  brand: Brand;
  pack: Pack;
  /** Custom-pack id — when provided, the delete button appears next to
   *  the export button. Curated packs leave this undefined. */
  customPackId?: string;
};

export function PackActions({ brand, pack, customPackId }: PackActionsProps) {
  return (
    <section
      className="border-b"
      style={{
        background: brand.tokens.surface,
        borderColor: brand.tokens.line,
      }}
    >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div className="flex flex-col gap-0.5">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: brand.tokens.inkMuted }}
          >
            Pack-Export
          </span>
          <span className="text-[13px]" style={{ color: brand.tokens.inkMuted }}>
            Cover, Inhaltsverzeichnis, alle Karten und Nährwert-Übersicht in
            einem druckfertigen PDF.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {customPackId ? (
            <PackCoverRerollButton
              packId={customPackId}
              tint={{
                bg: pack.mood.background,
                ink: pack.mood.ink,
                accent: pack.mood.accent,
              }}
            />
          ) : null}
          {customPackId ? (
            <PackDeleteButton
              packId={customPackId}
              brandSlug={brand.slug}
              tint={{
                ink: pack.mood.ink,
                inkSoft: pack.mood.inkSoft,
              }}
            />
          ) : null}
          <PdfExportButton
            type="pack"
            brandSlug={brand.slug}
            packSlug={pack.slug}
            variant="hero"
            label="Komplettes Pack als PDF"
            tint={{
              bg: pack.mood.background,
              ink: pack.mood.ink,
              accent: pack.mood.accent,
            }}
          />
        </div>
      </div>
    </section>
  );
}
