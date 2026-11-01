/** Moeda do Hotel em pixel art. */
export function Coin({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" className="crisp inline-block" aria-hidden>
      <rect x="2" y="0" width="4" height="8" fill="#b9791f" />
      <rect x="0" y="2" width="8" height="4" fill="#b9791f" />
      <rect x="1" y="1" width="6" height="6" fill="#f2b84b" />
      <rect x="3" y="2" width="2" height="4" fill="#fff1b8" />
    </svg>
  );
}

export function CoinAmount({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 font-pixel text-sm text-gold ${className}`}>
      <Coin /> {value}
    </span>
  );
}
