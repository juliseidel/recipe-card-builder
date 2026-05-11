// iOS-style bee icon — rendered as inline SVG so it looks identical on
// every OS (Windows users were getting the flat system bee glyph, which
// felt off-brand). Same geometry as the PDF variant in lib/pdf/bee-icon.tsx
// so the booklet and the web view stay in lockstep.

type Props = {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

export function BeeIcon({ size = 16, className, style }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      style={style}
      aria-hidden
      role="img"
    >
      <path
        d="M27 24 Q24 16 22 12"
        stroke="#2b1f19"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M37 24 Q40 16 42 12"
        stroke="#2b1f19"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      <circle cx={22} cy={12} r={2} fill="#2b1f19" />
      <circle cx={42} cy={12} r={2} fill="#2b1f19" />
      <ellipse
        cx={20}
        cy={24}
        rx={10}
        ry={7}
        fill="#cfe8ff"
        stroke="#9bbedb"
        strokeWidth={0.7}
      />
      <ellipse
        cx={44}
        cy={24}
        rx={10}
        ry={7}
        fill="#cfe8ff"
        stroke="#9bbedb"
        strokeWidth={0.7}
      />
      <ellipse
        cx={32}
        cy={40}
        rx={18}
        ry={17}
        fill="#F4C44A"
        stroke="#2b1f19"
        strokeWidth={1.5}
      />
      <path
        d="M15 35 Q32 37 49 35 L49 40 Q32 42 15 40 Z"
        fill="#2b1f19"
      />
      <path
        d="M15 47 Q32 49 49 47 L49 52 Q32 54 15 52 Z"
        fill="#2b1f19"
      />
      <circle cx={26} cy={32} r={2.4} fill="#2b1f19" />
      <circle cx={38} cy={32} r={2.4} fill="#2b1f19" />
      <circle cx={26.5} cy={31.3} r={0.8} fill="#fff" />
      <circle cx={38.5} cy={31.3} r={0.8} fill="#fff" />
    </svg>
  );
}
