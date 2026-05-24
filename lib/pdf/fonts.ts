import { Font } from "@react-pdf/renderer";

let registered = false;

const cdnBase = "https://cdn.jsdelivr.net/fontsource/fonts";

export function registerPdfFonts() {
  if (registered) return;
  registered = true;

  Font.register({
    family: "Fraunces",
    fonts: [
      { src: `${cdnBase}/fraunces@latest/latin-400-normal.ttf`, fontWeight: 400 },
      { src: `${cdnBase}/fraunces@latest/latin-500-normal.ttf`, fontWeight: 500 },
      { src: `${cdnBase}/fraunces@latest/latin-600-normal.ttf`, fontWeight: 600 },
      { src: `${cdnBase}/fraunces@latest/latin-700-normal.ttf`, fontWeight: 700 },
    ],
  });

  Font.register({
    family: "Inter",
    fonts: [
      { src: `${cdnBase}/inter@latest/latin-400-normal.ttf`, fontWeight: 400 },
      { src: `${cdnBase}/inter@latest/latin-500-normal.ttf`, fontWeight: 500 },
      { src: `${cdnBase}/inter@latest/latin-600-normal.ttf`, fontWeight: 600 },
      { src: `${cdnBase}/inter@latest/latin-700-normal.ttf`, fontWeight: 700 },
    ],
  });

  Font.register({
    family: "DMSerif",
    fonts: [
      {
        src: `${cdnBase}/dm-serif-display@latest/latin-400-normal.ttf`,
        fontWeight: 400,
      },
    ],
  });

  Font.register({
    family: "Caveat",
    fonts: [
      { src: `${cdnBase}/caveat@latest/latin-400-normal.ttf`, fontWeight: 400 },
      { src: `${cdnBase}/caveat@latest/latin-500-normal.ttf`, fontWeight: 500 },
      { src: `${cdnBase}/caveat@latest/latin-600-normal.ttf`, fontWeight: 600 },
      { src: `${cdnBase}/caveat@latest/latin-700-normal.ttf`, fontWeight: 700 },
    ],
  });

  Font.registerHyphenationCallback((word: string) => [word]);
}

export const pdfFontFamily = (font: string): string => {
  if (font.includes("fraunces")) return "Fraunces";
  if (font.includes("dm-serif")) return "DMSerif";
  if (font.includes("caveat")) return "Caveat";
  return "Inter";
};
