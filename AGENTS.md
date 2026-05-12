<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Creator-Onboarding (Image-Pipeline)

**Wenn der User sagt _"ich habe einen neuen Creator angelegt"_ oder _"neuer Creator: @handle"_ → lies zuerst [CREATOR_ONBOARDING.md](./CREATOR_ONBOARDING.md).**

Kurzfassung:
- Hero-Pipeline (`lib/ai/generate-hero.ts`) ist für alle Creator IDENTISCH.
- Jeder Creator bekommt einen **Code-Brand-Style** als eigene Konstante in `lib/ai/brand-image-style.ts` (wie `BIENE_STYLE`).
- Du analysierst seine Reels, schreibst `{CREATOR}_STYLE`, ergänzt die `STYLES`-Map + `lib/brands.ts`, committest + pushst.
- **Niemals** Pipeline-Files pro Creator ändern. Nur Brand-DNA-Slots.
- **Niemals** existierende Brand-Styles anfassen (z.B. `BIENE_STYLE`) wenn du einen neuen Creator anlegst — andere Brands sind durch separate Konstanten + Map-Lookup garantiert isoliert.

Vollständiger Workflow + Garantien + Cheat-Sheet: siehe [CREATOR_ONBOARDING.md](./CREATOR_ONBOARDING.md).
