import { hash01, tileCenter, WALL_H, type RoomGeometry } from "@/lib/iso";

/** 0 = limpo … 4 = calamidade. Espelha os degraus de 20 pontos do banco. */
export function dirtLevel(score: number): 0 | 1 | 2 | 3 | 4 {
  if (score >= 100) return 0;
  if (score >= 80) return 1;
  if (score >= 60) return 2;
  if (score >= 40) return 3;
  return 4;
}

export const DIRT_LABELS = ["Impecável", "Empoeirado", "Teias surgindo", "Abandonado", "Calamidade"] as const;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Teia em leque a partir de um canto, entre dois ângulos (graus, eixo y para baixo). */
function Cobweb({ cx, cy, from, to, length }: { cx: number; cy: number; from: number; to: number; length: number }) {
  const spokes = 6;
  const angles = Array.from({ length: spokes }, (_, i) => from + ((to - from) * i) / (spokes - 1));
  const rings = [0.28, 0.5, 0.72, 0.94];
  const pt = (a: number, r: number) => [cx + Math.cos(rad(a)) * r, cy + Math.sin(rad(a)) * r] as const;

  return (
    <g stroke="#e8e8f0" strokeWidth={0.8} fill="none" opacity={0.8}>
      {angles.map((a, i) => {
        const [x, y] = pt(a, length);
        return <line key={`s${i}`} x1={cx} y1={cy} x2={x} y2={y} />;
      })}
      {rings.map((r, ri) =>
        angles.slice(0, -1).map((a, i) => {
          const [x1, y1] = pt(a, length * r);
          const [x2, y2] = pt(angles[i + 1], length * r);
          const [mx, my] = pt((a + angles[i + 1]) / 2, length * r * 0.82);
          return <path key={`r${ri}-${i}`} d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`} />;
        }),
      )}
    </g>
  );
}

/** Camada de sujeira desenhada dentro do SVG do quarto (paredes e piso). */
export function DirtLayer({ geom, level }: { geom: RoomGeometry; level: number }) {
  if (level === 0) return null;
  const { originX, originY, cols, rows } = geom;
  const topCorner = { x: originX, y: originY - WALL_H };
  const leftEnd = { x: originX - rows * 32, y: originY + rows * 16 - WALL_H };
  const rightEnd = { x: originX + cols * 32, y: originY + cols * 16 - WALL_H };

  const dust: React.ReactNode[] = [];
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      if (hash01(x, y) > level * 0.2) continue;
      const c = tileCenter(geom, x, y);
      const ox = (hash01(x, y, 2) - 0.5) * 24;
      const oy = (hash01(x, y, 3) - 0.5) * 8;
      dust.push(
        <g key={`${x}-${y}`} opacity={0.35 + level * 0.1}>
          <ellipse cx={c.x + ox} cy={c.y + oy} rx={10 + level * 2} ry={4 + level} fill="#6b5a44" />
          <rect x={c.x + ox - 6} y={c.y + oy - 1} width={2} height={2} fill="#4a3d2d" />
          <rect x={c.x + ox + 4} y={c.y + oy + 1} width={2} height={2} fill="#4a3d2d" />
        </g>,
      );
    }
  }

  return (
    <g pointerEvents="none">
      {dust}
      {level >= 2 && (
        <>
          {/* manchas nas paredes */}
          <ellipse cx={originX - 70} cy={originY - 30} rx={14} ry={22} fill="#5e4b32" opacity={0.25} />
          <ellipse cx={originX + 90} cy={originY - 10} rx={10} ry={18} fill="#5e4b32" opacity={0.2} />
          <Cobweb cx={topCorner.x} cy={topCorner.y} from={27} to={153} length={30 + level * 10} />
        </>
      )}
      {level >= 3 && (
        <>
          <Cobweb cx={leftEnd.x} cy={leftEnd.y} from={-27} to={90} length={36} />
          <Cobweb cx={rightEnd.x} cy={rightEnd.y} from={90} to={207} length={36} />
        </>
      )}
      {level >= 4 && (
        <polygon
          points={`${topCorner.x},${topCorner.y} ${rightEnd.x},${rightEnd.y} ${rightEnd.x},${rightEnd.y + WALL_H} ${originX + (cols - rows) * 32},${
            originY + (cols + rows) * 16
          } ${leftEnd.x},${leftEnd.y + WALL_H} ${leftEnd.x},${leftEnd.y}`}
          fill="#0b0a12"
          opacity={0.28}
        />
      )}
    </g>
  );
}

/** Aranha pendurada e moscas — camada acima de tudo (z alto). */
export function CreepyLayer({ geom, level }: { geom: RoomGeometry; level: number }) {
  if (level < 3) return null;
  const { originX, originY } = geom;
  const flies =
    level >= 4
      ? [0, 1, 2].map((i) => {
          const c = tileCenter(geom, 1 + i * 2, 2 + (i % 2) * 2);
          return (
            <div
              key={i}
              className="absolute h-1 w-1 animate-fly rounded-full bg-black"
              style={{ left: c.x, top: c.y - 30, animationDelay: `${i * 0.6}s` }}
            />
          );
        })
      : null;

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 9000 }}>
      <div className="absolute origin-top animate-swing" style={{ left: originX - 1, top: originY - WALL_H }}>
        <div className="mx-auto h-14 w-px bg-white/60" />
        <svg width={14} height={12} viewBox="0 0 7 6" className="crisp -ml-[7px]">
          <rect x={2} y={1} width={3} height={3} fill="#111" />
          <rect x={0} y={1} width={2} height={1} fill="#111" />
          <rect x={5} y={1} width={2} height={1} fill="#111" />
          <rect x={0} y={3} width={2} height={1} fill="#111" />
          <rect x={5} y={3} width={2} height={1} fill="#111" />
          <rect x={3} y={2} width={1} height={1} fill="#ef6b5b" />
        </svg>
      </div>
      {flies}
    </div>
  );
}
