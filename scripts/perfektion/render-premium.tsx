// Premium-Seiten-Renderer: Cover + Vorwort + Schluss als 3-Seiten-PDF.
// Bienes Brand: sage #dce5d4 / ink #2f3a2f / inkSoft #5f6b5a / accent #6b7f5e.
// Fonts Fraunces + Inter. Bilder full-bleed/Banner, Text als Vektor-Overlay
// (perfekte Umlaute). Keine Em-Dashes.
//
// Aufruf: tsx scripts/perfektion/render-premium.tsx <config.json>

import React from "react";
import fs from "node:fs";
import path from "node:path";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Font,
  renderToFile,
} from "@react-pdf/renderer";

const FONT_DIR = path.join(process.cwd(), "public", "fonts");
const fp = (f: string) => path.join(FONT_DIR, f);
Font.register({
  family: "Fraunces",
  fonts: [
    { src: fp("Fraunces-Regular.woff"), fontWeight: 400 },
    { src: fp("Fraunces-Italic.woff"), fontWeight: 400, fontStyle: "italic" },
    { src: fp("Fraunces-SemiBold.woff"), fontWeight: 600 },
    { src: fp("Fraunces-Bold.woff"), fontWeight: 700 },
  ],
});
Font.register({
  family: "Inter",
  fonts: [
    { src: fp("Inter-Regular.woff"), fontWeight: 400 },
    { src: fp("Inter-Italic.woff"), fontWeight: 400, fontStyle: "italic" },
    { src: fp("Inter-Medium.woff"), fontWeight: 500 },
    { src: fp("Inter-SemiBold.woff"), fontWeight: 600 },
    { src: fp("Inter-Bold.woff"), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const cfg = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const e = React.createElement;

// Brand-Palette
const C = {
  bg: cfg.bg || "#dce5d4",
  ink: cfg.ink || "#2f3a2f",
  inkSoft: cfg.inkSoft || "#5f6b5a",
  accent: cfg.accent || "#6b7f5e",
};
const A4W = 595;
const A4H = 840;

// ─── COVER: Vollbild 3:4 + Text-Overlay unten auf hellem Scrim ───
function CoverPage(p: any) {
  return e(
    Page,
    { size: "A4", style: { position: "relative", padding: 0 } },
    e(Image, {
      src: p.image,
      style: { position: "absolute", top: 0, left: 0, width: A4W, height: A4H, objectFit: "cover" },
    }),
    // Scrim ist jetzt direkt ins Bild gebrannt (add-scrim.mjs) -> kein Overlay-Block.
    e(
      View,
      { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 48, paddingBottom: 54 } },
      e(Text, { style: { fontFamily: "Inter", fontWeight: 700, fontSize: 11, letterSpacing: 3, color: C.ink, marginBottom: 14, textTransform: "uppercase" } }, p.kicker),
      e(Text, { style: { fontFamily: "Fraunces", fontWeight: 700, fontSize: 56, lineHeight: 0.98, letterSpacing: -0.8, color: C.ink, maxWidth: 470 } }, p.title),
      p.subtitle ? e(Text, { style: { fontFamily: "Fraunces", fontStyle: "italic", fontSize: 15, lineHeight: 1.4, color: C.inkSoft, marginTop: 16, maxWidth: 430 } }, p.subtitle) : null,
      p.footer ? e(Text, { style: { fontFamily: "Inter", fontWeight: 500, fontSize: 10, letterSpacing: 2, color: C.inkSoft, marginTop: 22, textTransform: "uppercase" } }, p.footer) : null
    )
  );
}

// ─── VORWORT: Bild-Banner oben (Crop vom 3:4) + Textblock unten ───
function ForewordPage(p: any) {
  const bannerH = 384;
  return e(
    Page,
    { size: "A4", style: { position: "relative", padding: 0, backgroundColor: C.bg } },
    // Banner
    e(View, { style: { position: "absolute", top: 0, left: 0, width: A4W, height: bannerH, overflow: "hidden" } },
      e(Image, { src: p.image, style: { width: A4W, height: A4W * 1.34, objectFit: "cover", objectPosition: "center 32%" } })
    ),
    // Textblock
    e(
      View,
      { style: { position: "absolute", top: bannerH, left: 0, right: 0, bottom: 0, paddingHorizontal: 56, paddingTop: 38 } },
      e(Text, { style: { fontFamily: "Inter", fontWeight: 600, fontSize: 10, letterSpacing: 3, color: C.accent, textTransform: "uppercase", marginBottom: 16 } }, p.kicker || "Vorwort"),
      e(Text, { style: { fontFamily: "Fraunces", fontWeight: 600, fontStyle: "italic", fontSize: 25, lineHeight: 1.18, color: C.ink, maxWidth: 430, marginBottom: 20 } }, p.greeting),
      ...(p.paragraphs || []).map((para: string, i: number) =>
        e(Text, { key: i, style: { fontFamily: "Inter", fontWeight: 400, fontSize: 11.5, lineHeight: 1.62, color: C.inkSoft, marginBottom: 14, maxWidth: 452 } }, para)
      ),
      p.pullquote ? e(View, { style: { borderLeftWidth: 2, borderLeftColor: C.accent, paddingLeft: 16, marginTop: 6, marginBottom: 18 } },
        e(Text, { style: { fontFamily: "Fraunces", fontStyle: "italic", fontSize: 14.5, lineHeight: 1.4, color: C.ink, maxWidth: 420 } }, p.pullquote)
      ) : null,
      p.signoff ? e(Text, { style: { fontFamily: "Inter", fontWeight: 400, fontSize: 11.5, lineHeight: 1.6, color: C.inkSoft, marginBottom: 4 } }, p.signoff) : null,
      p.signature ? e(Text, { style: { fontFamily: "Fraunces", fontStyle: "italic", fontSize: 18, color: C.ink, marginTop: 10 } }, p.signature) : null
    )
  );
}

// ─── SCHLUSS: Vollbild 3:4 + Text-Overlay unten ───
function OutroPage(p: any) {
  return e(
    Page,
    { size: "A4", style: { position: "relative", padding: 0 } },
    e(Image, { src: p.image, style: { position: "absolute", top: 0, left: 0, width: A4W, height: A4H, objectFit: "cover" } }),
    e(
      View,
      { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 52, paddingBottom: 58, alignItems: "center" } },
      e(Text, { style: { fontFamily: "Fraunces", fontWeight: 700, fontStyle: "italic", fontSize: 40, color: C.ink, marginBottom: 18, textAlign: "center" } }, p.title),
      e(Text, { style: { fontFamily: "Inter", fontWeight: 400, fontSize: 12, lineHeight: 1.62, color: C.inkSoft, textAlign: "center", maxWidth: 400, marginBottom: 22 } }, p.body),
      p.footer ? e(Text, { style: { fontFamily: "Inter", fontWeight: 600, fontSize: 10, letterSpacing: 2, color: C.accent, textTransform: "uppercase" } }, p.footer) : null
    )
  );
}

function Doc() {
  const pages: any[] = [];
  if (cfg.cover) pages.push(e(CoverPage, { key: "c", ...cfg.cover }));
  if (cfg.foreword) pages.push(e(ForewordPage, { key: "f", ...cfg.foreword }));
  if (cfg.outro) pages.push(e(OutroPage, { key: "o", ...cfg.outro }));
  return e(Document, null, ...pages);
}

async function main() {
  await renderToFile(e(Doc), cfg.out);
  console.log("✓ PDF:", cfg.out);
}
main().catch((err) => { console.error("RENDER-FEHLER:", err); process.exit(1); });
