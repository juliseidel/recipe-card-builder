// Recipe-Card-Builder Logo: Stacked Cards mit Honey-Bookmark
//
// Visueller Anker des Tools: zwei gestapelte Karten, ein Honey-Bookmark
// auf der vorderen Karte. Zeigt direkt das Tool-Konzept (Recipe-Cards,
// Pack-Sammlungen) und passt zum Bienen-Universum durch den Honey-Akzent.
//
// Funktioniert in jeder Groesse (16×16 Browser-Tab bis 180×180 Apple-Icon).
// Drei Varianten:
// - "default": fuer Light-Background (Header), Cocoa-Black + Honey
// - "ink": Solid-Color, einfaerbig — fuer Drucksachen oder Einfarbig-
//   Designs (Footer auf dunklem Hintergrund etc.)
// - "outline": Outline-Variante, fuer subtile Plazierungen

type Props = {
  size?: number;
  variant?: "default" | "ink" | "outline";
  className?: string;
};

export function RecipeCardLogo({
  size = 36,
  variant = "default",
  className,
}: Props) {
  const ink = variant === "outline" ? "transparent" : "#2B1F19";
  const honey = variant === "ink" ? "currentColor" : "#F4C44A";
  const lineColor = variant === "outline" ? "#2B1F19" : "#FBF7F0";
  const stroke = variant === "outline" ? "currentColor" : "#2B1F19";
  const backCardOpacity = variant === "outline" ? 0.65 : 0.55;
  const backCardFill = variant === "outline" ? "transparent" : "#FBF7F0";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Recipe Card Builder"
    >
      {/* Hintere Karte */}
      <rect
        x="3.5"
        y="7"
        width="19"
        height="22"
        rx="2.5"
        stroke={stroke}
        strokeWidth="1.6"
        fill={backCardFill}
        opacity={backCardOpacity}
      />
      {/* Vordere Karte */}
      <rect x="7" y="3" width="22" height="24" rx="3" fill={ink} />
      {/* Recipe-Lines auf vorderer Karte */}
      <line
        x1="11"
        y1="13"
        x2="22"
        y2="13"
        stroke={lineColor}
        strokeWidth="1.2"
        opacity="0.55"
        strokeLinecap="round"
      />
      <line
        x1="11"
        y1="17"
        x2="20"
        y2="17"
        stroke={lineColor}
        strokeWidth="1.2"
        opacity="0.55"
        strokeLinecap="round"
      />
      <line
        x1="11"
        y1="21"
        x2="22"
        y2="21"
        stroke={lineColor}
        strokeWidth="1.2"
        opacity="0.55"
        strokeLinecap="round"
      />
      {/* Bookmark Honey — der visuelle Anker, zweite-Brand-Farbe */}
      <path d="M22 3 L27 3 L27 11.5 L24.5 9.8 L22 11.5 Z" fill={honey} />
    </svg>
  );
}
