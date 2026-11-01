import { shade } from "@/lib/color";
import { HALF_H, HALF_W } from "@/lib/iso";

/*
 * Sprites de mobília em SVG isométrico (arte original do BetHotel).
 *
 * Cada móvel é desenhado na orientação "original" (rot 0) num espaço local:
 *   gx ∈ [-sx/2, sx/2], gy ∈ [-sy/2, sy/2], z = altura em px.
 * A frente do móvel é o lado gy = +sy/2 (virado para baixo-esquerda na tela).
 * Com rot 1 os eixos são trocados: o móvel passa a ocupar sy × sx e a frente
 * fica virada para baixo-direita. Os helpers abaixo fazem essa troca sozinhos.
 */

export interface Orientation {
  rot: 0 | 1;
}

function pt(o: Orientation, gx: number, gy: number, z: number): string {
  const [ax, ay] = o.rot ? [gy, gx] : [gx, gy];
  return `${(ax - ay) * HALF_W},${(ax + ay) * HALF_H - z}`;
}

/** Caixa isométrica com três faces sombreadas, já considerando a rotação. */
function Box({
  o,
  x0,
  x1,
  y0,
  y1,
  z0,
  z1,
  color,
  opacity,
}: {
  o: Orientation;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
  color: string;
  opacity?: number;
}) {
  // converte para eixos reais antes de escolher as faces visíveis
  const [a0, a1, b0, b1] = o.rot ? [y0, y1, x0, x1] : [x0, x1, y0, y1];
  const P = (ax: number, ay: number, z: number) => `${(ax - ay) * HALF_W},${(ax + ay) * HALF_H - z}`;
  const top = [P(a0, b0, z1), P(a1, b0, z1), P(a1, b1, z1), P(a0, b1, z1)].join(" ");
  const left = [P(a0, b1, z1), P(a1, b1, z1), P(a1, b1, z0), P(a0, b1, z0)].join(" ");
  const right = [P(a1, b0, z1), P(a1, b1, z1), P(a1, b1, z0), P(a1, b0, z0)].join(" ");
  return (
    <g stroke={shade(color, -0.55)} strokeWidth={0.6} strokeLinejoin="round" opacity={opacity}>
      <polygon points={left} fill={color} />
      <polygon points={right} fill={shade(color, -0.22)} />
      <polygon points={top} fill={shade(color, 0.18)} />
    </g>
  );
}

/** Painel desenhado na face frontal (plano gy = v) — telas, prateleiras, botões. */
function Panel({ o, u0, u1, v, z0, z1, fill, opacity }: { o: Orientation; u0: number; u1: number; v: number; z0: number; z1: number; fill: string; opacity?: number }) {
  return <polygon points={[pt(o, u0, v, z1), pt(o, u1, v, z1), pt(o, u1, v, z0), pt(o, u0, v, z0)].join(" ")} fill={fill} opacity={opacity} />;
}

/** Losango plano no chão (tapetes). */
function Flat({ o, x0, x1, y0, y1, z = 1, fill, stroke }: { o: Orientation; x0: number; x1: number; y0: number; y1: number; z?: number; fill: string; stroke?: string }) {
  return (
    <polygon
      points={[pt(o, x0, y0, z), pt(o, x1, y0, z), pt(o, x1, y1, z), pt(o, x0, y1, z)].join(" ")}
      fill={fill}
      stroke={stroke}
      strokeWidth={stroke ? 1 : 0}
    />
  );
}

export interface SpriteDef {
  /** Pisos ocupados na orientação original (espelha shop_items.size_x/size_y). */
  sx: number;
  sy: number;
  /** Altura máxima acima do chão, em px. */
  height: number;
  sittable: boolean;
  /** 'floor' = tapete: dá para pisar e pôr móveis por cima. */
  layer: "solid" | "floor";
  seatZ?: number;
  /** Clicar abre o Dashboard do Apostador. */
  opensStats?: boolean;
  render: (o: Orientation, extra: SpriteExtra) => React.ReactNode;
}

export interface SpriteExtra {
  /** Troféus a exibir (Estante de Troféus). */
  trophies?: number;
}

const WOOD = "#9a6b3f";
const WOOD_DARK = "#6e4a2a";

export const FURNITURE_SPRITES: Record<string, SpriteDef> = {
  // ---------------------------------------------------------------- kit inicial
  bed_basic: {
    sx: 1,
    sy: 2,
    height: 40,
    sittable: true,
    layer: "solid",
    seatZ: 16,
    render: (o) => (
      <g>
        <Box o={o} x0={-0.48} x1={0.48} y0={-1} y1={-0.9} z0={0} z1={34} color={WOOD_DARK} />
        <Box o={o} x0={-0.46} x1={0.46} y0={-0.9} y1={0.94} z0={2} z1={11} color={WOOD} />
        <Box o={o} x0={-0.42} x1={0.42} y0={-0.88} y1={0.9} z0={11} z1={17} color="#ece6d6" />
        <Box o={o} x0={-0.3} x1={0.3} y0={-0.84} y1={-0.56} z0={17} z1={22} color="#fffaf0" />
        <Box o={o} x0={-0.44} x1={0.44} y0={-0.25} y1={0.91} z0={16} z1={19} color="#7a5c8f" />
        <Box o={o} x0={-0.48} x1={0.48} y0={0.9} y1={1} z0={0} z1={18} color={WOOD_DARK} />
      </g>
    ),
  },
  bed_double: {
    sx: 2,
    sy: 2,
    height: 44,
    sittable: true,
    layer: "solid",
    seatZ: 18,
    render: (o) => (
      <g>
        {/* cabeceira estofada roxa */}
        <Box o={o} x0={-0.96} x1={0.96} y0={-1} y1={-0.86} z0={0} z1={40} color="#5b3a8f" />
        <Box o={o} x0={-0.92} x1={0.92} y0={-0.86} y1={0.94} z0={2} z1={12} color="#8a5a32" />
        <Box o={o} x0={-0.88} x1={0.88} y0={-0.84} y1={0.9} z0={12} z1={18} color="#f3efe6" />
        <Box o={o} x0={-0.8} x1={-0.1} y0={-0.8} y1={-0.5} z0={18} z1={24} color="#ffffff" />
        <Box o={o} x0={0.1} x1={0.8} y0={-0.8} y1={-0.5} z0={18} z1={24} color="#ffffff" />
        {/* colcha mostarda */}
        <Box o={o} x0={-0.9} x1={0.9} y0={-0.3} y1={0.92} z0={17} z1={20} color="#e0a83a" />
        <Box o={o} x0={-0.9} x1={0.9} y0={-0.3} y1={-0.2} z0={20} z1={21} color="#f2c35a" />
      </g>
    ),
  },
  chair_basic: {
    sx: 1,
    sy: 1,
    height: 44,
    sittable: true,
    layer: "solid",
    seatZ: 14,
    render: (o) => (
      <g>
        {[
          [-0.28, -0.28],
          [0.22, -0.28],
          [-0.28, 0.22],
          [0.22, 0.22],
        ].map(([x, y], i) => (
          <Box key={i} o={o} x0={x} x1={x + 0.06} y0={y} y1={y + 0.06} z0={0} z1={14} color={WOOD_DARK} />
        ))}
        <Box o={o} x0={-0.3} x1={0.3} y0={-0.34} y1={-0.26} z0={14} z1={40} color={WOOD} />
        <Box o={o} x0={-0.3} x1={0.3} y0={-0.28} y1={0.3} z0={13} z1={17} color={WOOD} />
      </g>
    ),
  },

  // ------------------------------------------------------------ mobílias básicas
  plant: {
    sx: 1,
    sy: 1,
    height: 64,
    sittable: false,
    layer: "solid",
    render: (o) => (
      <g>
        <Box o={o} x0={-0.17} x1={0.17} y0={-0.17} y1={0.17} z0={0} z1={16} color="#c46a3a" />
        <Box o={o} x0={-0.15} x1={0.15} y0={-0.15} y1={0.15} z0={16} z1={17} color="#5b3a22" />
        {/* yucca: tronco + folhas em leque (pixels) */}
        <rect x={-2} y={-36} width={4} height={20} fill="#7a5a36" className="crisp" />
        {[
          [-14, -44, 10, 4],
          [-10, -50, 8, 4],
          [-4, -58, 4, 10],
          [2, -52, 10, 4],
          [6, -46, 10, 4],
          [-12, -38, 8, 3],
          [4, -40, 10, 3],
          [-2, -48, 4, 6],
        ].map(([x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} fill={i % 2 ? "#3f9b4f" : "#5fbf62"} className="crisp" />
        ))}
      </g>
    ),
  },
  rug: {
    sx: 1,
    sy: 1,
    height: 16,
    sittable: false,
    layer: "floor",
    render: (o) => (
      <g>
        <Flat o={o} x0={-0.46} x1={0.46} y0={-0.46} y1={0.46} fill="#1f5f66" stroke="#123b40" />
        <Flat o={o} x0={-0.34} x1={0.34} y0={-0.34} y1={0.34} fill="#f2b84b" />
        <Flat o={o} x0={-0.24} x1={0.24} y0={-0.24} y1={0.24} fill="#1f5f66" />
        <Flat o={o} x0={-0.1} x1={0.1} y0={-0.1} y1={0.1} fill="#f3efe6" />
      </g>
    ),
  },
  lamp: {
    sx: 1,
    sy: 1,
    height: 72,
    sittable: false,
    layer: "solid",
    render: (o) => (
      <g>
        <Box o={o} x0={-0.15} x1={0.15} y0={-0.15} y1={0.15} z0={0} z1={3} color="#3a3a46" />
        <Box o={o} x0={-0.03} x1={0.03} y0={-0.03} y1={0.03} z0={3} z1={48} color="#55556a" />
        <circle cx={0} cy={-54} r={20} fill="#ffe9a8" opacity={0.18} />
        <Box o={o} x0={-0.2} x1={0.2} y0={-0.2} y1={0.2} z0={46} z1={64} color="#f5d68a" />
      </g>
    ),
  },
  table: {
    sx: 1,
    sy: 1,
    height: 40,
    sittable: false,
    layer: "solid",
    render: (o) => (
      <g>
        {[
          [-0.36, -0.36],
          [0.3, -0.36],
          [-0.36, 0.3],
          [0.3, 0.3],
        ].map(([x, y], i) => (
          <Box key={i} o={o} x0={x} x1={x + 0.06} y0={y} y1={y + 0.06} z0={0} z1={18} color={WOOD_DARK} />
        ))}
        <Box o={o} x0={-0.4} x1={0.4} y0={-0.4} y1={0.4} z0={18} z1={23} color={WOOD} />
        <Box o={o} x0={-0.1} x1={0.08} y0={-0.1} y1={0.06} z0={23} z1={30} color="#f3e9d2" />
      </g>
    ),
  },
  armchair: {
    sx: 1,
    sy: 1,
    height: 44,
    sittable: true,
    layer: "solid",
    seatZ: 14,
    render: (o) => (
      <g>
        <Box o={o} x0={-0.34} x1={0.34} y0={-0.42} y1={-0.22} z0={2} z1={36} color="#2f6f5a" />
        <Box o={o} x0={-0.34} x1={0.34} y0={-0.22} y1={0.36} z0={2} z1={14} color="#2f6f5a" />
        <Box o={o} x0={-0.28} x1={0.28} y0={-0.2} y1={0.32} z0={14} z1={17} color="#3f8a70" />
        <Box o={o} x0={-0.34} x1={-0.22} y0={-0.22} y1={0.36} z0={14} z1={24} color="#25584a" />
        <Box o={o} x0={0.22} x1={0.34} y0={-0.22} y1={0.36} z0={14} z1={24} color="#25584a" />
      </g>
    ),
  },

  // ------------------------------------------------------------ conforto & lazer
  sofa_mode: {
    sx: 2,
    sy: 1,
    height: 44,
    sittable: true,
    layer: "solid",
    seatZ: 16,
    render: (o) => (
      <g>
        <Box o={o} x0={-0.96} x1={0.96} y0={-0.48} y1={-0.26} z0={3} z1={36} color="#34518a" />
        <Box o={o} x0={-0.96} x1={0.96} y0={-0.26} y1={0.44} z0={3} z1={13} color="#34518a" />
        <Box o={o} x0={-0.86} x1={-0.02} y0={-0.24} y1={0.42} z0={13} z1={18} color="#4a6db0" />
        <Box o={o} x0={0.02} x1={0.86} y0={-0.24} y1={0.42} z0={13} z1={18} color="#4a6db0" />
        <Box o={o} x0={-0.6} x1={-0.3} y0={-0.26} y1={-0.18} z0={18} z1={30} color="#7a95cc" />
        <Box o={o} x0={-0.98} x1={-0.86} y0={-0.4} y1={0.44} z0={3} z1={24} color="#2a4272" />
        <Box o={o} x0={0.86} x1={0.98} y0={-0.4} y1={0.44} z0={3} z1={24} color="#2a4272" />
      </g>
    ),
  },
  rug_large: {
    sx: 2,
    sy: 2,
    height: 24,
    sittable: false,
    layer: "floor",
    render: (o) => (
      <g>
        <Flat o={o} x0={-0.96} x1={0.96} y0={-0.96} y1={0.96} fill="#d9a441" stroke="#7a5a1a" />
        <Flat o={o} x0={-0.86} x1={0.86} y0={-0.86} y1={0.86} fill="#7a1f2b" />
        <Flat o={o} x0={-0.5} x1={0.5} y0={-0.5} y1={0.5} fill="#9a2c3a" stroke="#d9a441" />
      </g>
    ),
  },
  bookshelf: {
    sx: 2,
    sy: 1,
    height: 78,
    sittable: false,
    layer: "solid",
    render: (o) => {
      const books = ["#c0453c", "#3f7fb8", "#f2b84b", "#3f9b4f", "#7b4fc0", "#e8dcc0", "#ef6b5b", "#2f3e66"];
      return (
        <g>
          <Box o={o} x0={-0.96} x1={0.96} y0={-0.46} y1={0.02} z0={0} z1={72} color={WOOD} />
          <Panel o={o} u0={-0.9} u1={0.9} v={0.02} z0={4} z1={68} fill="#3d2816" />
          {[6, 28, 50].map((z, row) =>
            Array.from({ length: 9 }).map((_, i) => {
              const u = -0.86 + i * 0.19;
              const h = 14 + ((i * 7 + row * 3) % 5);
              return <Panel key={`${row}-${i}`} o={o} u0={u} u1={u + 0.15} v={0.02} z0={z} z1={z + h} fill={books[(i + row * 3) % books.length]} />;
            }),
          )}
          {[4, 26, 48, 68].map((z) => (
            <Panel key={z} o={o} u0={-0.92} u1={0.92} v={0.02} z0={z - 2} z1={z} fill={WOOD_DARK} />
          ))}
        </g>
      );
    },
  },
  meeting_table: {
    sx: 2,
    sy: 1,
    height: 40,
    sittable: false,
    layer: "solid",
    render: (o) => (
      <g>
        <Box o={o} x0={-0.6} x1={-0.44} y0={-0.1} y1={0.1} z0={0} z1={24} color="#3a3a46" />
        <Box o={o} x0={0.44} x1={0.6} y0={-0.1} y1={0.1} z0={0} z1={24} color="#3a3a46" />
        <Box o={o} x0={-0.94} x1={0.94} y0={-0.44} y1={0.44} z0={24} z1={29} color="#6b4a2f" />
        <Box o={o} x0={-0.5} x1={-0.2} y0={-0.1} y1={0.12} z0={29} z1={30} color="#f3efe6" />
        <Box o={o} x0={0.2} x1={0.42} y0={-0.2} y1={0.05} z0={29} z1={30} color="#f3efe6" />
        <Box o={o} x0={0.6} x1={0.7} y0={0.1} y1={0.2} z0={29} z1={36} color="#7cc4f0" />
      </g>
    ),
  },

  // ------------------------------------------------------- eletrônicos & destaques
  stereo: {
    sx: 1,
    sy: 1,
    height: 48,
    sittable: false,
    layer: "solid",
    render: (o) => (
      <g>
        <Box o={o} x0={-0.42} x1={0.42} y0={-0.3} y1={0.3} z0={0} z1={14} color={WOOD} />
        <Box o={o} x0={-0.44} x1={-0.24} y0={-0.26} y1={0.2} z0={14} z1={44} color="#2b2b33" />
        <Box o={o} x0={0.24} x1={0.44} y0={-0.26} y1={0.2} z0={14} z1={44} color="#2b2b33" />
        <Panel o={o} u0={-0.4} u1={-0.28} v={0.2} z0={18} z1={28} fill="#555566" />
        <Panel o={o} u0={-0.4} u1={-0.28} v={0.2} z0={32} z1={40} fill="#555566" />
        <Panel o={o} u0={0.28} u1={0.4} v={0.2} z0={18} z1={28} fill="#555566" />
        <Panel o={o} u0={0.28} u1={0.4} v={0.2} z0={32} z1={40} fill="#555566" />
        <Box o={o} x0={-0.2} x1={0.2} y0={-0.2} y1={0.14} z0={14} z1={30} color="#3a3a46" />
        <Panel o={o} u0={-0.16} u1={0.06} v={0.14} z0={22} z1={27} fill="#5fd3a8" />
        <Panel o={o} u0={0.09} u1={0.15} v={0.14} z0={17} z1={23} fill="#ef6b5b" />
      </g>
    ),
  },
  tv_plasma: {
    sx: 1,
    sy: 1,
    height: 60,
    sittable: false,
    layer: "solid",
    render: (o) => (
      <g>
        <Box o={o} x0={-0.44} x1={0.44} y0={-0.3} y1={0.18} z0={0} z1={12} color="#3a3a46" />
        <Box o={o} x0={-0.06} x1={0.06} y0={-0.1} y1={-0.04} z0={12} z1={18} color="#22232b" />
        <Box o={o} x0={-0.47} x1={0.47} y0={-0.12} y1={-0.04} z0={18} z1={54} color="#15161c" />
        <Panel o={o} u0={-0.43} u1={0.43} v={-0.04} z0={21} z1={51} fill="#2d5fa0" />
        <Panel o={o} u0={-0.43} u1={0.43} v={-0.04} z0={21} z1={30} fill="#3f9b4f" />
        <Panel o={o} u0={0.1} u1={0.26} v={-0.04} z0={38} z1={46} fill="#f2d27a" />
      </g>
    ),
  },
  trophy_case: {
    sx: 1,
    sy: 1,
    height: 64,
    sittable: false,
    layer: "solid",
    opensStats: true,
    render: (o, { trophies = 0 }) => {
      // até 6 troféus visíveis: 3 por prateleira
      const shown = Math.min(6, trophies);
      const slots = [
        [-14, -34],
        [-3, -40],
        [8, -34],
        [-14, -50],
        [-3, -56],
        [8, -50],
      ];
      return (
        <g>
          <Box o={o} x0={-0.36} x1={0.36} y0={-0.32} y1={0.32} z0={0} z1={14} color={WOOD_DARK} />
          <Box o={o} x0={-0.34} x1={0.34} y0={-0.3} y1={-0.24} z0={14} z1={58} color="#5e3c20" />
          <Box o={o} x0={-0.34} x1={0.34} y0={-0.3} y1={0.3} z0={34} z1={36} color={WOOD} />
          {slots.slice(0, shown).map(([x, y], i) => (
            <g key={i} className="crisp">
              <rect x={x} y={y} width={7} height={5} fill="#f2b84b" />
              <rect x={x - 2} y={y + 1} width={2} height={3} fill="#f2b84b" />
              <rect x={x + 7} y={y + 1} width={2} height={3} fill="#f2b84b" />
              <rect x={x + 2} y={y + 5} width={3} height={3} fill="#c98f2a" />
              <rect x={x + 1} y={y + 8} width={5} height={2} fill="#8a5a1a" />
            </g>
          ))}
          {shown === 0 && <rect x={-6} y={-40} width={12} height={2} fill="#3d2816" className="crisp" />}
          <Box o={o} x0={-0.34} x1={0.34} y0={-0.3} y1={0.3} z0={14} z1={58} color="#bfe3f2" opacity={0.28} />
          <Box o={o} x0={-0.36} x1={0.36} y0={-0.32} y1={0.32} z0={58} z1={62} color={WOOD_DARK} />
        </g>
      );
    },
  },
  snack_machine: {
    sx: 1,
    sy: 1,
    height: 84,
    sittable: false,
    layer: "solid",
    render: (o) => {
      const snacks = ["#f2b84b", "#ef6b5b", "#5fd3a8", "#7cc4f0", "#e8dcc0"];
      return (
        <g>
          <Box o={o} x0={-0.38} x1={0.38} y0={-0.32} y1={0.34} z0={0} z1={80} color="#c0453c" />
          <Panel o={o} u0={-0.32} u1={0.12} v={0.34} z0={28} z1={74} fill="#1d2a44" />
          {[32, 44, 56, 66].map((z, r) =>
            [0, 1, 2].map((c) => (
              <Panel key={`${r}-${c}`} o={o} u0={-0.29 + c * 0.13} u1={-0.2 + c * 0.13} v={0.34} z0={z} z1={z + 6} fill={snacks[(r + c) % snacks.length]} />
            )),
          )}
          <Panel o={o} u0={0.17} u1={0.32} v={0.34} z0={46} z1={66} fill="#c8c8d2" />
          <Panel o={o} u0={0.19} u1={0.3} v={0.34} z0={60} z1={64} fill="#5fd3a8" />
          <Panel o={o} u0={-0.3} u1={0.1} v={0.34} z0={10} z1={20} fill="#2b2b33" />
          <Panel o={o} u0={-0.36} u1={0.36} v={0.34} z0={76} z1={80} fill="#f3e9d2" />
        </g>
      );
    },
  },
};

/** Tamanho real no grid considerando a rotação. */
export function footprint(def: SpriteDef, rot: 0 | 1 = 0): { w: number; d: number } {
  return rot ? { w: def.sy, d: def.sx } : { w: def.sx, d: def.sy };
}

/** Sombra suave no chão sob o móvel. */
function FootShadow({ w, d }: { w: number; d: number }) {
  const P = (ax: number, ay: number) => `${(ax - ay) * HALF_W},${(ax + ay) * HALF_H}`;
  const a = w / 2 - 0.02;
  const b = d / 2 - 0.02;
  return <polygon points={[P(-a, -b), P(a, -b), P(a, b + 0.08), P(-a, b + 0.08)].join(" ")} fill="#000" opacity={0.18} />;
}

/** Caixa do SVG de um móvel (centro do footprint = 0,0). */
export function spriteBox(def: SpriteDef, rot: 0 | 1) {
  const { w, d } = footprint(def, rot);
  const halfX = (w + d) * (HALF_W / 2);
  const halfY = (w + d) * (HALF_H / 2);
  return { width: halfX * 2, height: halfY * 2 + def.height + 4, x: -halfX, y: -halfY - def.height, halfX, halfY };
}

/** SVG completo do móvel (sombra + desenho). */
export function FurnitureSvg({
  asset,
  rot = 0,
  glow,
  onClick,
  scale = 1,
  trophies,
}: {
  asset: string;
  rot?: 0 | 1;
  glow?: boolean;
  trophies?: number;
  onClick?: () => void;
  scale?: number;
}) {
  const def = FURNITURE_SPRITES[asset];
  if (!def) return null;
  const box = spriteBox(def, rot);
  const { w, d } = footprint(def, rot);
  return (
    <svg
      width={box.width * scale}
      height={box.height * scale}
      viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      className="pointer-events-none block overflow-visible"
      style={{ filter: glow ? "drop-shadow(0 0 4px #f2b84b) brightness(1.15)" : undefined }}
      aria-hidden
    >
      {def.layer === "solid" && <FootShadow w={w} d={d} />}
      <g className={onClick ? "pointer-events-auto cursor-pointer" : undefined} onClick={onClick}>
        {def.render({ rot }, { trophies })}
      </g>
    </svg>
  );
}
