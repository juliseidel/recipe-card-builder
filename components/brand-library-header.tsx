"use client";

import { useState } from "react";
import type { Brand } from "@/lib/brands";
import { LibraryStatusBanner } from "./library-status-banner";
import { PackSuggestionsSection } from "./pack-suggestions-section";

// Client-Wrapper, der den Library-Status-Banner mit der Suggestions-
// Section verkabelt. Wenn der Banner status='done' detected, bumpt er
// den refreshToken — die Section laedt frische Vorschlaege.
//
// Wird in app/[brand]/page.tsx unter dem SiteHeader gerendert, aber nur
// fuer DB-Brands (Code-Brand Biene hat keine Reel-Library).

export function BrandLibraryHeader({ brand }: { brand: Brand }) {
  const [refreshToken, setRefreshToken] = useState(0);
  return (
    <>
      <LibraryStatusBanner
        brand={brand}
        onDone={() => setRefreshToken(Date.now())}
      />
      <PackSuggestionsSection brand={brand} refreshToken={refreshToken} />
    </>
  );
}
