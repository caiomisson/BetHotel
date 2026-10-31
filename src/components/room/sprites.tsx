import { shade } from "@/lib/color";
import { HALF_H, HALF_W } from "@/lib/iso";

/*
 * Sprites de mobília em SVG isométrico (arte original).
 * Coordenadas locais: o centro do piso é (0,0); o piso vai de -0.5 a 0.5 em gx/gy.
 */

function iso(gx: number, gy: number, z: number): string {
  return `${(gx - gy) * HALF_W},${(gx + gy) * HALF_H - z}`;
}

interface BoxProps {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
  color: string;
}

/** Caixa isométrica com três faces sombreadas. */
function IsoBox({ x0, x1, y0, y1, z0, z1, color }: BoxProps) {
  const top = [iso(x0, y0, z1), iso(x1, y0, z1), iso(x1, y1, z1), iso(x0, y1, z1)].join(" ");
  const left = [iso(x0, y1, z1), iso(x1, y1, z1), iso(x1, y1, z0), iso(x0, y1, z0)].join(" ");
  const right = [iso(x1, y0, z1), iso(x1, y1, z1), iso(x1, y1, z0), iso(x1, y0, z0)].join(" ");
  return (
    <g stroke={shade(color, -0.55)} strokeWidth={0.6} strokeLinejoin="round">
      <polygon points={left} fill={color} />
      <polygon points={right} fill={shade(color, -0.22)} />
      <polygon points={top} fill={shade(color, 0.18)} />
    </g>
  );
}

/** Polígono na face frontal-esquerda (gy = y) de uma caixa — telas, painéis. */
function FacePanel({ x0, x1, y, z0, z1, fill }: { x0: number; x1: number; y: number; z0: number; z1: number; fill: string }) {
  return <polygon points={[iso(x0, y, z1), iso(x1, y, z1), iso(x1, y, z0), iso(x0, y, z0)].join(" ")} fill={fill} />;
}

export interface SpriteDef {
  /** Altura acima do centro do piso, em px. */
  height: number;
  sittable: boolean;
  /** Bloqueia a passagem do avatar. */
  blocking: boolean;
  /** Altura do assento (offset do avatar ao sentar). */
  seatZ?: number;
  render: () => React.ReactNode;
}

const WOOD = "#9a6b3f";

export const FURNITURE_SPRITES: Record<string, SpriteDef> = {
  rug: {
    height: 16,
    sittable: false,
    blocking: false,
    render: () => (
      <g>
        <polygon points={[iso(-0.48, -0.48, 1), iso(0.48, -0.48, 1), iso(0.48, 0.48, 1), iso(-0.48, 0.48, 1)].join(" ")} fill="#b8413a" stroke="#6e221d" strokeWidth={1} />
        <polygon points={[iso(-0.3, -0.3, 1), iso(0.3, -0.3, 1), iso(0.3, 0.3, 1), iso(-0.3, 0.3, 1)].join(" ")} fill="#e6c15a" />
        <polygon points={[iso(-0.12, -0.12, 1), iso(0.12, -0.12, 1), iso(0.12, 0.12, 1), iso(-0.12, 0.12, 1)].join(" ")} fill="#b8413a" />
      </g>
    ),
  },
  plant: {
    height: 60,
    sittable: false,
    blocking: true,
    render: () => (
      <g>
        <IsoBox x0={-0.17} x1={0.17} y0={-0.17} y1={0.17} z0={0} z1={18} color="#c46a3a" />
        {[
          [-6, -34, "#3f9b4f"],
          [2, -42, "#4fbf62"],
          [-10, -26, "#2f7f40"],
          [8, -30, "#3f9b4f"],
          [-2, -50, "#5fd36f"],
          [6, -22, "#2f7f40"],
        ].map(([x, y, fill], i) => (
          <rect key={i} x={x as number} y={y as number} width={8} height={10} fill={fill as string} className="crisp" />
        ))}
      </g>
    ),
  },
  lamp: {
    height: 72,
    sittable: false,
    blocking: true,
    render: () => (
      <g>
        <IsoBox x0={-0.15} x1={0.15} y0={-0.15} y1={0.15} z0={0} z1={3} color="#3a3a46" />
        <IsoBox x0={-0.03} x1={0.03} y0={-0.03} y1={0.03} z0={3} z1={48} color="#55556a" />
        <IsoBox x0={-0.2} x1={0.2} y0={-0.2} y1={0.2} z0={46} z1={64} color="#f5d68a" />
        <circle cx={0} cy={-40} r={18} fill="#ffe9a8" opacity={0.15} />
      </g>
    ),
  },
  armchair: {
    height: 44,
    sittable: true,
    blocking: true,
    seatZ: 14,
    render: () => (
      <g>
        <IsoBox x0={-0.32} x1={0.32} y0={-0.4} y1={-0.22} z0={2} z1={34} color="#3f7fb8" />
        <IsoBox x0={-0.32} x1={0.32} y0={-0.22} y1={0.34} z0={2} z1={14} color="#3f7fb8" />
        <IsoBox x0={0.2} x1={0.32} y0={-0.22} y1={0.34} z0={14} z1={22} color="#356a9a" />
        <IsoBox x0={-0.32} x1={-0.2} y0={-0.22} y1={0.34} z0={14} z1={22} color="#356a9a" />
      </g>
    ),
  },
  table: {
    height: 40,
    sittable: false,
    blocking: true,
    render: () => (
      <g>
        {[
          [-0.36, -0.36],
          [0.3, -0.36],
          [-0.36, 0.3],
          [0.3, 0.3],
        ].map(([x, y], i) => (
          <IsoBox key={i} x0={x} x1={x + 0.06} y0={y} y1={y + 0.06} z0={0} z1={20} color={shade(WOOD, -0.2)} />
        ))}
        <IsoBox x0={-0.4} x1={0.4} y0={-0.4} y1={0.4} z0={20} z1={25} color={WOOD} />
        <rect x={-4} y={-14} width={8} height={5} fill="#f3e9d2" className="crisp" />
      </g>
    ),
  },
  sofa: {
    height: 46,
    sittable: true,
    blocking: true,
    seatZ: 14,
    render: () => (
      <g>
        <IsoBox x0={-0.46} x1={0.46} y0={-0.46} y1={-0.26} z0={2} z1={36} color="#c0453c" />
        <IsoBox x0={-0.46} x1={0.46} y0={-0.26} y1={0.4} z0={2} z1={14} color="#c0453c" />
        <IsoBox x0={-0.4} x1={0.02} y0={-0.24} y1={0.36} z0={14} z1={17} color="#d85a4f" />
        <IsoBox x0={0.02} x1={0.4} y0={-0.24} y1={0.36} z0={14} z1={17} color="#d85a4f" />
        <IsoBox x0={-0.46} x1={-0.36} y0={-0.26} y1={0.4} z0={14} z1={24} color="#a23930" />
        <IsoBox x0={0.36} x1={0.46} y0={-0.26} y1={0.4} z0={14} z1={24} color="#a23930" />
      </g>
    ),
  },
  tv: {
    height: 64,
    sittable: false,
    blocking: true,
    render: () => (
      <g>
        <IsoBox x0={-0.3} x1={0.3} y0={-0.3} y1={0.2} z0={0} z1={16} color={WOOD} />
        <IsoBox x0={-0.26} x1={0.26} y0={-0.26} y1={0.1} z0={16} z1={52} color="#5b5b6b" />
        <FacePanel x0={-0.2} x1={0.16} y={0.1} z0={22} z1={48} fill="#7cc4f0" />
        <FacePanel x0={-0.16} x1={0.0} y={0.1} z0={36} z1={46} fill="#cdeeff" />
        <line x1={-4} y1={-48} x2={-12} y2={-62} stroke="#3a3a46" strokeWidth={1.5} />
        <line x1={0} y1={-48} x2={8} y2={-62} stroke="#3a3a46" strokeWidth={1.5} />
      </g>
    ),
  },
  arcade: {
    height: 84,
    sittable: false,
    blocking: true,
    render: () => (
      <g>
        <IsoBox x0={-0.3} x1={0.3} y0={-0.3} y1={0.25} z0={0} z1={74} color="#5a3ea8" />
        <FacePanel x0={-0.22} x1={0.22} y={0.25} z0={44} z1={66} fill="#101420" />
        <FacePanel x0={-0.18} x1={0.18} y={0.25} z0={48} z1={62} fill="#5fd3a8" />
        <FacePanel x0={-0.22} x1={0.22} y={0.25} z0={30} z1={38} fill="#f2b84b" />
        <FacePanel x0={-0.12} x1={-0.04} y={0.25} z0={32} z1={36} fill="#ef6b5b" />
        <FacePanel x0={0.04} x1={0.12} y={0.25} z0={32} z1={36} fill="#7cc4f0" />
      </g>
    ),
  },
};
