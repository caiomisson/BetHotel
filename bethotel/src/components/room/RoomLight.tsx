import { gridToScreen, WALL_H, type RoomGeometry } from "@/lib/iso";

/**
 * Iluminação do quarto.
 *  - flicker: lâmpada velha pendurada no fio, oscilando e escurecendo o quarto
 *  - led: luminária moderna, luz estável
 * A oscilação é suave e lenta (sem flashes) e desliga com "reduzir movimento".
 */
export function RoomLight({ geom, mode }: { geom: RoomGeometry; mode: "flicker" | "led" }) {
  const anchor = gridToScreen(geom, geom.cols * 0.5, geom.rows * 0.5);
  const top = gridToScreen(geom, 0, 0).y - WALL_H - 14;
  const bulbY = top + 74;
  const x = anchor.x;

  if (mode === "led") {
    return (
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 8500 }}>
        <svg className="absolute inset-0 overflow-visible" width="100%" height="100%">
          <defs>
            <radialGradient id="led-glow">
              <stop offset="0%" stopColor="#fff7df" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#fff7df" stopOpacity={0} />
            </radialGradient>
          </defs>
          <ellipse cx={x} cy={bulbY + 90} rx={170} ry={90} fill="url(#led-glow)" />
          <line x1={x} y1={top} x2={x} y2={bulbY - 8} stroke="#2b2b33" strokeWidth={1.5} />
          <rect x={x - 14} y={bulbY - 8} width={28} height={7} rx={1} fill="#2b2b33" />
          <rect x={x - 12} y={bulbY - 1} width={24} height={3} fill="#fffbe8" />
        </svg>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 8500 }}>
      {/* escurecimento oscilante do quarto */}
      <div className="absolute inset-0 animate-flicker-dim bg-[#0b0a12] opacity-25 motion-reduce:animate-none" />
      <svg className="absolute inset-0 overflow-visible" width="100%" height="100%">
        <defs>
          <radialGradient id="bulb-glow">
            <stop offset="0%" stopColor="#ffd98a" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#ffd98a" stopOpacity={0} />
          </radialGradient>
        </defs>
        <g className="animate-flicker-glow motion-reduce:animate-none">
          <circle cx={x} cy={bulbY + 6} r={46} fill="url(#bulb-glow)" />
        </g>
        <line x1={x} y1={top} x2={x} y2={bulbY - 4} stroke="#2b2b33" strokeWidth={1} />
        <rect x={x - 3} y={bulbY - 5} width={6} height={4} fill="#55556a" />
        <circle cx={x} cy={bulbY + 4} r={5} fill="#fff1b8" stroke="#c9a84b" strokeWidth={1} className="animate-flicker-glow motion-reduce:animate-none" />
      </svg>
    </div>
  );
}
