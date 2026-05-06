import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import { PdfExportButton } from "./pdf-export-button";

type PackActionsProps = {
  brand: Brand;
  pack: Pack;
};

export function PackActions({ brand, pack }: PackActionsProps) {
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
    </section>
  );
}
