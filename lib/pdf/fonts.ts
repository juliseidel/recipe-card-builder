import { Font } from "@react-pdf/renderer";
import path from "node:path";
import fs from "node:fs";

let registered = false;

function readFontAsDataUri(filename: string): string {
  const filePath = path.join(process.cwd(), "public", "fonts", filename);
  const buffer = fs.readFileSync(filePath);
  return `data:font/woff;base64,${buffer.toString("base64")}`;
}

export function ensureFontsRegistered() {
  if (registered) return;

  Font.register({
    family: "Fraunces",
    fonts: [
      { src: readFontAsDataUri("Fraunces-Regular.woff"), fontWeight: 400 },
      {
        src: readFontAsDataUri("Fraunces-Italic.woff"),
        fontWeight: 400,
        fontStyle: "italic",
      },
      { src: readFontAsDataUri("Fraunces-SemiBold.woff"), fontWeight: 600 },
      { src: readFontAsDataUri("Fraunces-Bold.woff"), fontWeight: 700 },
    ],
  });

  Font.register({
    family: "Inter",
    fonts: [
      { src: readFontAsDataUri("Inter-Regular.woff"), fontWeight: 400 },
      {
        src: readFontAsDataUri("Inter-Italic.woff"),
        fontWeight: 400,
        fontStyle: "italic",
      },
      { src: readFontAsDataUri("Inter-Medium.woff"), fontWeight: 500 },
      { src: readFontAsDataUri("Inter-SemiBold.woff"), fontWeight: 600 },
      { src: readFontAsDataUri("Inter-Bold.woff"), fontWeight: 700 },
    ],
  });

  // German recipe text — keep words intact, no auto-hyphenation
  Font.registerHyphenationCallback((word) => [word]);

  // Twemoji as emoji glyph source — fixes the "Deine Biene 🐝" signature
  // (and dashboard icons) which would otherwise render as the .notdef glyph.
  // jsDelivr-hosted, pinned version. Fetched at render time, cached per emoji.
  Font.registerEmojiSource({
    format: "png",
    url: "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/",
  });

  registered = true;
}
