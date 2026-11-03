"use client";

import { useEffect, useId, useState } from "react";
import { shade } from "@/lib/color";
import { gridToScreen, hash01, WALL_H, type RoomGeometry } from "@/lib/iso";
import type { RoomDecor } from "@/lib/types";

interface RoomWallsProps {
  geom: RoomGeometry;
  decor: RoomDecor;
  roomNumber: number | null;
  onStatsClick: () => void;
}

const SKEW = 26.565; // inclinação 2:1 das paredes

/** Faixas ocupadas pela janela (parede esquerda) e pela placa do quarto (parede direita). */
export function wallFeatures(cols: number, rows: number): { window: [number, number]; plaque: [number, number] } {
  const winW = Math.min(1.5, rows * 0.36);
  const w0 = Math.min(Math.max(0.35, rows * 0.22), rows - winW - 0.3);
  const plaqueW = Math.min(1.1, cols * 0.28);
  const p0 = Math.min(cols * 0.58, cols - plaqueW - 0.25);
  return { window: [w0, w0 + winW], plaque: [p0, p0 + plaqueW] };
}

/** Altura (z) do centro dos quadros pendurados. */
export const WALL_ITEM_Z = 74;

/** Dia entre 6h e 18h no relógio de quem está vendo. */
function useIsDay() {
  const [day, setDay] = useState(true);
  useEffect(() => {
    const h = new Date().getHours();
    setDay(h >= 6 && h < 18);
  }, []);
  return day;
}

/**
 * Paredes do quarto:
 *  - peeling: papel de parede escuro descascando (estado inicial)
 *  - paint: tinta lisa na cor escolhida
 *  - texture: tijolinho ou relevo 3D na cor escolhida
 * Janela na parede esquerda (dia/noite) e placa do quarto na direita (abre estatísticas).
 */
export function RoomWalls({ geom, decor, roomNumber, onStatsClick }: RoomWallsProps) {
  const uid = useId().replace(/:/g, "");
  const isDay = useIsDay();
  const { cols, rows } = geom;

  const top = gridToScreen(geom, 0, 0);
  const rightFloor = gridToScreen(geom, cols, 0);
  const leftFloor = gridToScreen(geom, 0, rows);
  const L = (gy: number, z: number) => {
    const p = gridToScreen(geom, 0, gy);
    return `${p.x},${p.y - z}`;
  };
  const R = (gx: number, z: number) => {
    const p = gridToScreen(geom, gx, 0);
    return `${p.x},${p.y - z}`;
  };
  const Lp = (gy: number, z: number) => {
    const p = gridToScreen(geom, 0, gy);
    return { x: p.x, y: p.y - z };
  };
  const Rp = (gx: number, z: number) => {
    const p = gridToScreen(geom, gx, 0);
    return { x: p.x, y: p.y - z };
  };
  const leftWall = `${L(0, WALL_H)} ${L(0, 0)} ${L(rows, 0)} ${L(rows, WALL_H)}`;
  const rightWall = `${R(0, WALL_H)} ${R(cols, WALL_H)} ${R(cols, 0)} ${R(0, 0)}`;

  const peeling = decor.wall === "peeling";
  const base = peeling ? "#3a4254" : decor.wallColor;
  const leftFill = shade(base, -0.06);
  const rightFill = shade(base, -0.2);

  const f = wallFeatures(cols, rows);
  const win = { g0: f.window[0], z0: 46, z1: 96 };
  const winG1 = f.window[1];
  const winW = winG1 - win.g0;
  const plaque = { g0: f.plaque[0], z0: 64, z1: 90 };
  const plaqueG1 = f.plaque[1];

  return (
    <g>
      <defs>
        {(["l", "r"] as const).map((side) => (
          <pattern key={`brick-${side}`} id={`${uid}-brick-${side}`} patternUnits="userSpaceOnUse" width={24} height={12} patternTransform={`skewY(${side === "l" ? -SKEW : SKEW})`}>
            <rect width={24} height={12} fill={side === "l" ? leftFill : rightFill} />
            <path d="M0 0.5H24M0 6.5H24M6 0.5V6.5M18 6.5V12" stroke={shade(base, -0.4)} strokeWidth={1} opacity={0.6} />
          </pattern>
        ))}
        {(["l", "r"] as const).map((side) => {
          const f = side === "l" ? leftFill : rightFill;
          return (
            <pattern key={`relief-${side}`} id={`${uid}-relief-${side}`} patternUnits="userSpaceOnUse" width={16} height={16} patternTransform={`skewY(${side === "l" ? -SKEW : SKEW})`}>
              <rect width={16} height={16} fill={f} />
              <rect x={2} y={2} width={12} height={12} fill={shade(f, 0.12)} />
              <path d="M2 14H14V2" stroke={shade(f, -0.28)} strokeWidth={1.5} fill="none" />
              <path d="M2 14V2H14" stroke={shade(f, 0.3)} strokeWidth={1} fill="none" />
            </pattern>
          );
        })}
      </defs>

      <polygon points={leftWall} fill={leftFill} />
      <polygon points={rightWall} fill={rightFill} />
      {decor.wall === "texture" && (
        <>
          <polygon points={leftWall} fill={`url(#${uid}-${decor.texture}-l)`} />
          <polygon points={rightWall} fill={`url(#${uid}-${decor.texture}-r)`} />
        </>
      )}
      {peeling && <PeelingFlakes rows={rows} cols={cols} Lp={Lp} Rp={Rp} />}

      {/* rodapés */}
      <polygon points={`${L(0, 6)} ${L(rows, 6)} ${L(rows, 0)} ${L(0, 0)}`} fill="#2a2f3b" />
      <polygon points={`${R(0, 6)} ${R(cols, 6)} ${R(cols, 0)} ${R(0, 0)}`} fill="#222632" />

      {/* espessura das paredes (borda azul-escura como no mockup) */}
      <polyline
        points={`${leftFloor.x},${leftFloor.y - WALL_H} ${top.x},${top.y - WALL_H} ${rightFloor.x},${rightFloor.y - WALL_H}`}
        fill="none"
        stroke="#26324d"
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <line x1={leftFloor.x} y1={leftFloor.y - WALL_H} x2={leftFloor.x} y2={leftFloor.y} stroke="#26324d" strokeWidth={5} />
      <line x1={rightFloor.x} y1={rightFloor.y - WALL_H} x2={rightFloor.x} y2={rightFloor.y} stroke="#26324d" strokeWidth={5} />
      <line x1={top.x} y1={top.y - WALL_H} x2={top.x} y2={top.y} stroke="#000" strokeOpacity={0.25} strokeWidth={1.5} />

      {/* janela (parede esquerda) */}
      <polygon points={`${L(win.g0 - 0.08, win.z1 + 5)} ${L(winG1 + 0.08, win.z1 + 5)} ${L(winG1 + 0.08, win.z0 - 5)} ${L(win.g0 - 0.08, win.z0 - 5)}`} fill="#26324d" />
      <polygon points={`${L(win.g0, win.z1)} ${L(winG1, win.z1)} ${L(winG1, win.z0)} ${L(win.g0, win.z0)}`} fill={isDay ? "#8fd0f5" : "#101a33"} />
      {isDay ? (
        <polygon points={`${L(win.g0 + 0.15, win.z1 - 10)} ${L(win.g0 + 0.6, win.z1 - 10)} ${L(win.g0 + 0.6, win.z1 - 18)} ${L(win.g0 + 0.15, win.z1 - 18)}`} fill="#fff" opacity={0.75} />
      ) : (
        <g>
          {(() => {
            const m = Lp(winG1 - 0.32, win.z1 - 16);
            return (
              <g>
                <circle cx={m.x} cy={m.y} r={6} fill="#f3efe6" />
                <circle cx={m.x + 3} cy={m.y - 2} r={5} fill="#101a33" />
              </g>
            );
          })()}
          {[
            [0.25, 0.3],
            [0.55, 0.55],
            [0.35, 0.8],
            [0.75, 0.25],
          ].map(([g, z], i) => {
            const p = Lp(win.g0 + g * winW, win.z0 + z * (win.z1 - win.z0));
            return <rect key={i} x={p.x} y={p.y} width={1.5} height={1.5} fill="#cfe3ff" />;
          })}
        </g>
      )}
      <polyline points={`${L((win.g0 + winG1) / 2, win.z1)} ${L((win.g0 + winG1) / 2, win.z0)}`} stroke="#26324d" strokeWidth={2.5} />
      <polyline points={`${L(win.g0, (win.z0 + win.z1) / 2)} ${L(winG1, (win.z0 + win.z1) / 2)}`} stroke="#26324d" strokeWidth={2.5} />

      {/* Placa do quarto (parede direita) — abre o Dashboard do Apostador */}
      <g
        role="button"
        tabIndex={0}
        aria-label="Abrir quadro de estatísticas"
        className="cursor-pointer outline-none [&:hover>polygon:first-child]:stroke-gold [&:focus-visible>polygon:first-child]:stroke-gold"
        onClick={onStatsClick}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onStatsClick()}
      >
        <polygon points={`${R(plaque.g0, plaque.z1)} ${R(plaqueG1, plaque.z1)} ${R(plaqueG1, plaque.z0)} ${R(plaque.g0, plaque.z0)}`} fill="#d9b27a" stroke="#6e4a2a" strokeWidth={3} />
        <polygon
          points={`${R(plaque.g0 + 0.08, plaque.z1 - 4)} ${R(plaqueG1 - 0.08, plaque.z1 - 4)} ${R(plaqueG1 - 0.08, plaque.z0 + 4)} ${R(plaque.g0 + 0.08, plaque.z0 + 4)}`}
          fill="none"
          stroke="#8a6438"
          strokeWidth={1}
        />
        {(() => {
          const c = Rp((plaque.g0 + plaqueG1) / 2, (plaque.z0 + plaque.z1) / 2);
          return (
            <text
              x={0}
              y={0}
              transform={`translate(${c.x} ${c.y + 4}) skewY(${SKEW})`}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
              fill="#4a3018"
              fontFamily="var(--font-pixel)"
              pointerEvents="none"
            >
              {roomNumber ?? "STATS"}
            </text>
          );
        })()}
      </g>
    </g>
  );
}

/** Pedaços de papel de parede descascando (posições fixas por quarto). */
function PeelingFlakes({
  rows,
  cols,
  Lp,
  Rp,
}: {
  rows: number;
  cols: number;
  Lp: (g: number, z: number) => { x: number; y: number };
  Rp: (g: number, z: number) => { x: number; y: number };
}) {
  const flakes: React.ReactNode[] = [];
  const add = (side: "l" | "r", len: number) => {
    const count = Math.round(len * 5.5);
    for (let i = 0; i < count; i++) {
      const g = 0.15 + hash01(i, len, side === "l" ? 3 : 7) * (len - 0.3);
      const z = 12 + hash01(i, len, side === "l" ? 11 : 13) * (WALL_H - 26);
      const p = side === "l" ? Lp(g, z) : Rp(g, z);
      const w = 5 + hash01(i, 1, 5) * 5;
      const h = 4 + hash01(i, 2, 9) * 4;
      const skew = side === "l" ? -SKEW : SKEW;
      const rot = (hash01(i, 3, 2) - 0.5) * 40;
      flakes.push(
        <g key={`${side}${i}`} transform={`translate(${p.x} ${p.y}) skewY(${skew}) rotate(${rot})`}>
          <polygon points={`0,${-h / 2} ${w / 2},0 0,${h / 2} ${-w / 2},0`} fill="#8b93a3" />
          <polygon points={`0,${-h / 2} ${w / 2},0 0,0`} fill="#a9b0bd" />
          <polyline points={`${-w / 2},0 0,${h / 2} ${w / 2},0`} fill="none" stroke="#252a35" strokeWidth={0.8} />
        </g>,
      );
    }
  };
  add("l", rows);
  add("r", cols);
  return (
    <g pointerEvents="none" opacity={0.85}>
      {flakes}
      {/* manchas de umidade */}
      {(() => {
        const a = Lp(rows * 0.75, WALL_H - 18);
        const b = Rp(cols * 0.3, 30);
        return (
          <>
            <ellipse cx={a.x} cy={a.y} rx={16} ry={20} fill="#1d222c" opacity={0.35} />
            <ellipse cx={b.x} cy={b.y} rx={18} ry={12} fill="#1d222c" opacity={0.3} />
          </>
        );
      })()}
    </g>
  );
}
