// Apple-iOS-Style Biene. Wir rendern das echte Emoji 🐝 mit erzwungenem
// Apple-Color-Emoji-Font, damit Bienes Brand-Glyph auf macOS/iOS Safari +
// Chrome immer als Apple-Bee dargestellt wird (gelb-orange Körper, schwarze
// Streifen, blasse Flügel). Auf Windows/Android fällt der Browser auf den
// jeweiligen System-Emoji-Font zurück — der größte Teil von Bienes Audience
// ist iOS-mobile, daher ist Apple-Look bei den meisten Viewern garantiert.
//
// `font-variant-emoji: emoji` zwingt die Emoji-Glyph-Variante, falls der
// Browser sie unterstützt (Chrome 122+, Safari 18+, Firefox 119+).

type Props = {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

export function BeeIcon({ size = 16, className, style }: Props) {
  return (
    <span
      className={className}
      role="img"
      aria-label="Biene"
      style={{
        fontFamily:
          '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", emoji',
        fontSize: size,
        lineHeight: 1,
        display: "inline-block",
        verticalAlign: "middle",
        fontStyle: "normal",
        fontWeight: 400,
        // @ts-expect-error — font-variant-emoji is a valid CSS property
        // (CSS Fonts Level 4) but not yet in React's CSSProperties type
        fontVariantEmoji: "emoji",
      }}
    >
      🐝
    </span>
  );
}
