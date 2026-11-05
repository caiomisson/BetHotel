import { shade } from "@/lib/color";
import { HALF_H, HALF_W } from "@/lib/iso";
import type { SpriteDef } from "./sprites";

/** Mesmo valor de Z_SCALE em sprites.tsx (evita import circular). */
const ZS = 1.3;
function Raw({ children }: { children: React.ReactNode }) {
  return <g transform={`scale(1 ${ZS})`}>{children}</g>;
}

/*
 * Itens de conquista (arte original).
 *  - wall: desenhados "de frente" numa caixa ~44x34 centrada em (0,0); o quarto
 *    inclina o desenho para acompanhar a parede.
 *  - table: pequenos, com base em z = 0; o quarto os levanta até o tampo da mesa.
 *  - solid/floor: igual aos outros móveis.
 */

const GOLD = "#f2b84b";
const GOLD_D = "#c98f2a";
const GOLD_L = "#ffe08a";

function isoPt(gx: number, gy: number, z: number) {
  return `${(gx - gy) * HALF_W},${(gx + gy) * HALF_H - z * ZS}`;
}
function Box({ x0, x1, y0, y1, z0, z1, color }: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; color: string }) {
  const top = [isoPt(x0, y0, z1), isoPt(x1, y0, z1), isoPt(x1, y1, z1), isoPt(x0, y1, z1)].join(" ");
  const left = [isoPt(x0, y1, z1), isoPt(x1, y1, z1), isoPt(x1, y1, z0), isoPt(x0, y1, z0)].join(" ");
  const right = [isoPt(x1, y0, z1), isoPt(x1, y1, z1), isoPt(x1, y1, z0), isoPt(x1, y0, z0)].join(" ");
  return (
    <g stroke={shade(color, -0.6)} strokeWidth={1} strokeLinejoin="round">
      <polygon points={left} fill={color} />
      <polygon points={right} fill={shade(color, -0.22)} />
      <polygon points={top} fill={shade(color, 0.18)} />
    </g>
  );
}

/** Touro em pixel art (de lado), ancorado pelos cascos em (0,0). */
function Bull({ s = 1, color = GOLD }: { s?: number; color?: string }) {
  const px: [number, number, number, number, string][] = [
    [-7, -9, 11, 5, color],
    [-6, -10, 8, 1, color],
    [3, -11, 4, 5, color],
    [6, -9, 2, 2, color],
    [3, -13, 1, 2, GOLD_L],
    [6, -13, 1, 2, GOLD_L],
    [5, -10, 1, 1, "#3d2816"],
    [-6, -4, 2, 4, shade(color, -0.2)],
    [-2, -4, 2, 4, color],
    [1, -4, 2, 4, shade(color, -0.2)],
    [4, -4, 2, 4, color],
    [-8, -9, 1, 3, shade(color, -0.2)],
    [-5, -8, 4, 1, GOLD_L],
  ];
  return (
    <g transform={`scale(${s})`} className="crisp">
      {px.map(([x, y, w, h, f], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={f} />
      ))}
    </g>
  );
}

export const PRIZE_SPRITES: Record<string, SpriteDef> = {
  // ---------------------------------------------------------------- parede
  frame_rio: {
    sx: 1, sy: 1, height: 34, sittable: false, layer: "wall",
    render: () => (
      <g>
        <rect x={-22} y={-17} width={44} height={34} fill={GOLD} stroke={GOLD_D} strokeWidth={1.5} />
        <rect x={-18} y={-13} width={36} height={26} fill="#7cc4f0" />
        <circle cx={10} cy={-6} r={3.5} fill="#ffe08a" />
        <path d="M-18 6 Q-12 -12 -6 2 Q0 -6 4 4 L4 13 L-18 13 Z" fill="#2f7f40" />
        <path d="M-2 4 Q6 -4 12 6 L18 6 L18 13 L-2 13 Z" fill="#3f9b4f" />
        <rect x={-18} y={8} width={36} height={5} fill="#2d6fb3" />
        <rect x={-14} y={9} width={6} height={1} fill="#cdeeff" />
        <rect x={4} y={10} width={8} height={1} fill="#cdeeff" />
        <text x={0} y={-8} textAnchor="middle" fontSize={5} fill="#1d2a44" fontFamily="var(--font-pixel)">DESTINO: RIO</text>
      </g>
    ),
  },
  frame_backpacker: {
    sx: 1, sy: 1, height: 34, sittable: false, layer: "wall",
    render: () => (
      <g>
        <rect x={-22} y={-17} width={44} height={34} fill="#6e4a2a" stroke="#3d2816" strokeWidth={1.5} />
        <rect x={-18} y={-13} width={36} height={26} fill="#f2d27a" />
        <path d="M-18 13 L-8 -4 L-2 4 L6 -9 L18 13 Z" fill="#5b6475" />
        <path d="M-10 -1 L-8 -4 L-6 -1 Z M4 -6 L6 -9 L8 -6 Z" fill="#f3efe6" />
        <rect x={-15} y={1} width={7} height={9} fill="#c0453c" />
        <rect x={-14} y={-1} width={5} height={2} fill="#8a2f28" />
        <rect x={-14} y={4} width={5} height={1} fill="#8a2f28" />
        <text x={4} y={11} textAnchor="middle" fontSize={4.5} fill="#1d2a44" fontFamily="var(--font-pixel)">MOCHILEIRO</text>
        <text x={4} y={-12} textAnchor="middle" fontSize={4} fill="#3d2816" fontFamily="var(--font-pixel)">DE ELITE</text>
      </g>
    ),
  },
  plaque_duel: {
    sx: 1, sy: 1, height: 30, sittable: false, layer: "wall",
    render: () => (
      <g>
        <rect x={-20} y={-14} width={40} height={28} rx={4} fill="#8a5a32" stroke="#4a3018" strokeWidth={1.5} />
        <rect x={-17} y={-11} width={34} height={22} rx={2} fill="#6e4424" />
        <g stroke={GOLD_L} strokeWidth={2} strokeLinecap="square">
          <line x1={-8} y1={-8} x2={8} y2={4} />
          <line x1={8} y1={-8} x2={-8} y2={4} />
        </g>
        <rect x={-10} y={-1} width={4} height={2} fill={GOLD_D} />
        <rect x={6} y={-1} width={4} height={2} fill={GOLD_D} />
        <text x={0} y={10} textAnchor="middle" fontSize={5} fill={GOLD} fontFamily="var(--font-pixel)">DUELO VENCIDO</text>
      </g>
    ),
  },
  neon_curticao: {
    sx: 1, sy: 1, height: 28, sittable: false, layer: "wall",
    render: () => (
      <g>
        <rect x={-23} y={-12} width={46} height={24} rx={3} fill="#15101f" stroke="#2a2040" strokeWidth={1} />
        <text x={0} y={3} textAnchor="middle" fontSize={8.5} fill="none" stroke="#ff4fd8" strokeWidth={3} opacity={0.35} fontFamily="var(--font-pixel)">CURTIÇÃO</text>
        <text x={0} y={3} textAnchor="middle" fontSize={8.5} fill="#ffd1f5" stroke="#ff4fd8" strokeWidth={0.8} fontFamily="var(--font-pixel)">CURTIÇÃO</text>
        <path d="M-16 7 H16" stroke="#5fd3f5" strokeWidth={1.2} opacity={0.9} />
      </g>
    ),
  },

  // ------------------------------------------------------------- em cima da mesa
  photo_abada: {
    sx: 1, sy: 1, height: 22, sittable: false, layer: "table",
    render: () => (
      <Raw>
        <polygon points="-9,0 9,-4 9,-20 -9,-16" fill={GOLD} stroke={GOLD_D} strokeWidth={0.8} />
        <polygon points="-7,-2 7,-5 7,-18 -7,-15" fill="#7b4fc0" />
        <rect x={-3} y={-14} width={4} height={6} fill="#f2b84b" transform="skewY(-12)" />
        <rect x={-2} y={-17} width={2} height={2} fill="#f1c27d" transform="skewY(-12)" />
        {[
          [-5, -12, "#ef6b5b"],
          [4, -14, "#5fd3a8"],
          [2, -9, "#7cc4f0"],
          [-4, -7, "#ffe08a"],
        ].map(([x, y, f], i) => (
          <rect key={i} x={x as number} y={y as number} width={1.5} height={1.5} fill={f as string} />
        ))}
        <text x={0} y={-3} textAnchor="middle" fontSize={3} fill="#fff" fontFamily="var(--font-pixel)" transform="skewY(-12)">ABADÁ</text>
      </Raw>
    ),
  },
  lamp_cifrao: {
    sx: 1, sy: 1, height: 26, sittable: false, layer: "table",
    render: () => (
      <g>
        <Raw>
          <circle cx={0} cy={-18} r={11} fill="#ffe9a8" opacity={0.18} />
        </Raw>
        <Box x0={-0.1} x1={0.1} y0={-0.1} y1={0.1} z0={0} z1={2} color="#2b2b33" />
        <Box x0={-0.02} x1={0.02} y0={-0.02} y1={0.02} z0={2} z1={12} color="#55556a" />
        <Box x0={-0.14} x1={0.14} y0={-0.14} y1={0.14} z0={11} z1={22} color={GOLD} />
        <text x={0} y={-12 * ZS} textAnchor="middle" fontSize={8} fill="#3d2816" fontFamily="var(--font-pixel)">$</text>
      </g>
    ),
  },
  bull_wallstreet: {
    sx: 1, sy: 1, height: 20, sittable: false, layer: "table",
    render: () => (
      <g>
        <Box x0={-0.16} x1={0.16} y0={-0.1} y1={0.1} z0={0} z1={3} color="#1d1d24" />
        <g transform={`translate(0 ${-4 * ZS})`}>
          <Bull s={0.9} />
        </g>
      </g>
    ),
  },

  // ----------------------------------------------------------------- chão
  champagne_gold: {
    sx: 1, sy: 1, height: 58, sittable: false, layer: "solid",
    render: () => (
      <g>
        <Box x0={-0.22} x1={0.22} y0={-0.22} y1={0.22} z0={0} z1={22} color="#2b2b33" />
        <Box x0={-0.06} x1={0.06} y0={-0.06} y1={0.06} z0={22} z1={44} color={GOLD} />
        <Box x0={-0.03} x1={0.03} y0={-0.03} y1={0.03} z0={44} z1={54} color={GOLD_D} />
        <Raw>
        <rect x={-1.5} y={-58} width={3} height={4} fill="#c0453c" className="crisp" />
        <rect x={-2} y={-40} width={4} height={6} fill="#f3efe6" className="crisp" />
        <g className="crisp">
          <rect x={-14} y={-34} width={4} height={6} fill="#cdeeff" />
          <rect x={-13} y={-28} width={2} height={5} fill="#cdeeff" />
          <rect x={10} y={-36} width={4} height={6} fill="#cdeeff" />
          <rect x={11} y={-30} width={2} height={5} fill="#cdeeff" />
          <rect x={-8} y={-50} width={1.5} height={1.5} fill={GOLD_L} />
          <rect x={7} y={-54} width={1.5} height={1.5} fill={GOLD_L} />
          <rect x={4} y={-46} width={1} height={1} fill="#fff" />
        </g>
        </Raw>
      </g>
    ),
  },
  bull_bbq: {
    sx: 1, sy: 1, height: 50, sittable: false, layer: "solid",
    render: () => (
      <g>
        <Box x0={-0.32} x1={0.32} y0={-0.24} y1={0.24} z0={0} z1={16} color="#3a2a19" />
        <Box x0={-0.3} x1={0.3} y0={-0.22} y1={0.22} z0={16} z1={18} color="#6e4a2a" />
        <g transform={`translate(0 ${-18 * ZS})`}>
          <Bull s={2} />
        </g>
        <rect x={-12} y={-9 * ZS} width={24} height={2} fill="#ef6b5b" opacity={0.6} className="crisp" />
      </g>
    ),
  },
  rocking_chair_gold: {
    sx: 1, sy: 1, height: 48, sittable: true, seatZ: 14, layer: "solid",
    render: () => (
      <g>
        <path d={`M${isoPt(-0.4, 0.3, 2)} Q${isoPt(-0.05, 0.42, -4)} ${isoPt(0.3, 0.3, 2)}`} fill="none" stroke={GOLD_D} strokeWidth={2.5} />
        <path d={`M${isoPt(-0.4, -0.3, 2)} Q${isoPt(-0.05, -0.18, -4)} ${isoPt(0.3, -0.3, 2)}`} fill="none" stroke={GOLD_D} strokeWidth={2.5} />
        <Box x0={-0.3} x1={0.28} y0={-0.3} y1={0.3} z0={3} z1={14} color={GOLD} />
        <Box x0={-0.3} x1={-0.22} y0={-0.3} y1={0.3} z0={14} z1={42} color={GOLD} />
        <Box x0={-0.26} x1={0.24} y0={-0.26} y1={0.26} z0={14} z1={16} color="#c0453c" />
      </g>
    ),
  },
  rug_zebra: {
    sx: 1, sy: 1, height: 16, sittable: false, layer: "floor",
    render: () => (
      <g>
        <polygon points={[isoPt(-0.46, -0.4, 1), isoPt(0.46, -0.4, 1), isoPt(0.46, 0.4, 1), isoPt(-0.46, 0.4, 1)].join(" ")} fill="#f3efe6" stroke="#1d1d24" strokeWidth={1} />
        {[-0.34, -0.14, 0.06, 0.26].map((u, i) => (
          <polygon key={i} points={[isoPt(u, -0.4, 1), isoPt(u + 0.09, -0.4, 1), isoPt(u + 0.13, 0.4, 1), isoPt(u + 0.04, 0.4, 1)].join(" ")} fill="#1d1d24" />
        ))}
        <g transform="matrix(0.89,0.45,-0.89,0.45,0,0)">
          <rect x={-15} y={-3.5} width={30} height={7} fill="#f2b84b" />
          <text x={0} y={1.6} textAnchor="middle" fontSize={4} fill="#1d1d24" fontFamily="var(--font-pixel)">BEM-VINDO À ZEBRA</text>
        </g>
      </g>
    ),
  },
};
