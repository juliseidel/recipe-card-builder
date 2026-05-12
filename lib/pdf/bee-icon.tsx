import { Svg, Path, Circle, Ellipse } from "@react-pdf/renderer";

// PDF-Variante des iOS-Bienen-Icons. Geometrie 1:1 mit components/bee-icon.tsx
// — gerendert über @react-pdf/renderer Primitives, weil das PDF kein
// inline HTML-SVG aufnehmen kann. Größe wird per `size` prop skaliert.

// Brand-Slug ist Pflicht-Prop — Icon erscheint nur fuer Biene. Andere Creator
// (Julia etc.) bekommen kein Bee-Icon im PDF, die Signature steht allein.
export function BeeIcon({
  size = 14,
  brandSlug,
}: {
  size?: number;
  brandSlug: string;
}) {
  if (brandSlug !== "biene") return null;
  return (
    <Svg viewBox="0 0 64 64" width={size} height={size}>
      <Path
        d="M27 24 Q24 16 22 12"
        stroke="#2b1f19"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M37 24 Q40 16 42 12"
        stroke="#2b1f19"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      <Circle cx={22} cy={12} r={2} fill="#2b1f19" />
      <Circle cx={42} cy={12} r={2} fill="#2b1f19" />
      <Ellipse
        cx={20}
        cy={24}
        rx={10}
        ry={7}
        fill="#cfe8ff"
        stroke="#9bbedb"
        strokeWidth={0.7}
      />
      <Ellipse
        cx={44}
        cy={24}
        rx={10}
        ry={7}
        fill="#cfe8ff"
        stroke="#9bbedb"
        strokeWidth={0.7}
      />
      <Ellipse
        cx={32}
        cy={40}
        rx={18}
        ry={17}
        fill="#F4C44A"
        stroke="#2b1f19"
        strokeWidth={1.5}
      />
      <Path
        d="M15 35 Q32 37 49 35 L49 40 Q32 42 15 40 Z"
        fill="#2b1f19"
      />
      <Path
        d="M15 47 Q32 49 49 47 L49 52 Q32 54 15 52 Z"
        fill="#2b1f19"
      />
      <Circle cx={26} cy={32} r={2.4} fill="#2b1f19" />
      <Circle cx={38} cy={32} r={2.4} fill="#2b1f19" />
      <Circle cx={26.5} cy={31.3} r={0.8} fill="#fff" />
      <Circle cx={38.5} cy={31.3} r={0.8} fill="#fff" />
    </Svg>
  );
}
