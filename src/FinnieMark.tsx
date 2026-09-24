/**
 * Finnie: a fish whose tail is a candle. Drawn on a 64-unit grid so the same paths serve the
 * 16px topbar and the app icon (icon.svg at the repo root is this, on a tile).
 */
export function FinnieMark({ size = 16 }: { size?: number }) {
  return (
    <svg className="finnie-mark" viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <path className="body" d="M4 32 Q18 12 38 14 Q50 16 54 32 Q50 48 38 50 Q18 52 4 32 Z" />
      <rect className="body" x="52" y="20" width="8" height="24" rx="2" />
      <line className="wick" x1="56" y1="10" x2="56" y2="54" strokeWidth="3" strokeLinecap="round" />
      <circle className="eye" cx="18" cy="29" r="4" />
    </svg>
  );
}
