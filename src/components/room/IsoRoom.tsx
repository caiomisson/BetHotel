"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  depth,
  findPath,
  gridToScreen,
  nearestFreeNeighbor,
  roomGeometry,
  tileCenter,
  tileKey,
  WALL_H,
  type Point,
} from "@/lib/iso";
import type { AvatarConfig } from "@/lib/types";
import { Avatar, type AvatarPose } from "./Avatar";
import { CreepyLayer, DirtLayer, dirtLevel } from "./DirtOverlay";
import { FURNITURE_SPRITES } from "./sprites";

export interface PlacedFurniture {
  uid: string;
  asset: string;
  name: string;
  x: number;
  y: number;
}

export interface RoomAvatar {
  nickname: string;
  config: AvatarConfig;
}

interface IsoRoomProps {
  cols: number;
  rows: number;
  cleanliness: number;
  furniture: PlacedFurniture[];
  /** Avatar controlado pelo usuário logado. */
  player: RoomAvatar;
  /** Dono do quarto, exibido parado quando alguém está visitando. */
  host?: RoomAvatar;
  onTrophyClick: () => void;
  editMode?: boolean;
  selectedUid?: string | null;
  onEditTileClick?: (x: number, y: number) => void;
  onEditFurnitureClick?: (uid: string) => void;
}

const STEP_MS = 230;

export function IsoRoom({
  cols,
  rows,
  cleanliness,
  furniture,
  player,
  host,
  onTrophyClick,
  editMode,
  selectedUid,
  onEditTileClick,
  onEditFurnitureClick,
}: IsoRoomProps) {
  const geom = useMemo(() => roomGeometry(cols, rows), [cols, rows]);
  const level = dirtLevel(cleanliness);

  // ---- Ocupação do grid
  const blocked = useMemo(() => {
    const s = new Set<string>();
    furniture.forEach((f) => FURNITURE_SPRITES[f.asset]?.blocking && s.add(tileKey(f)));
    return s;
  }, [furniture]);

  const freeTiles = useMemo(() => {
    const list: Point[] = [];
    for (let y = rows - 1; y >= 0; y--) for (let x = cols - 1; x >= 0; x--) if (!blocked.has(tileKey({ x, y }))) list.push({ x, y });
    return list;
  }, [blocked, cols, rows]);

  const hostTile = host ? freeTiles.find((t) => t.x <= 1 && t.y >= rows - 3) ?? freeTiles[freeTiles.length - 1] : null;

  // ---- Estado do avatar
  const [pos, setPos] = useState<Point>(() => freeTiles[0] ?? { x: cols - 1, y: rows - 1 });
  const [path, setPath] = useState<Point[]>([]);
  const [facing, setFacing] = useState<"left" | "right">("left");
  const [frame, setFrame] = useState<0 | 1>(0);
  const [seat, setSeat] = useState<PlacedFurniture | null>(null);
  const pendingSeat = useRef<PlacedFurniture | null>(null);

  // Se um móvel for colocado em cima do avatar, reposiciona.
  useEffect(() => {
    if (!seat && blocked.has(tileKey(pos)) && freeTiles[0]) setPos(freeTiles[0]);
  }, [blocked, freeTiles, pos, seat]);

  // ---- Loop de caminhada
  useEffect(() => {
    if (path.length === 0) return;
    const t = setTimeout(() => {
      const [next, ...rest] = path;
      const dx = next.x - pos.x;
      const dy = next.y - pos.y;
      setFacing(dx > 0 || dy < 0 ? "right" : "left");
      setPos(next);
      setFrame((f) => (f === 0 ? 1 : 0));
      setPath(rest);
      if (rest.length === 0 && pendingSeat.current) {
        const target = pendingSeat.current;
        pendingSeat.current = null;
        if (FURNITURE_SPRITES[target.asset]?.sittable) {
          setTimeout(() => {
            setSeat(target);
            setFacing("left");
          }, STEP_MS);
        } else {
          setFacing(target.x - next.x > 0 || target.y - next.y < 0 ? "right" : "left");
        }
      }
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [path, pos]);

  const walkTo = useCallback(
    (goal: Point) => {
      pendingSeat.current = null;
      setSeat(null);
      const p = findPath(pos, goal, cols, rows, blocked);
      if (p) setPath(p);
    },
    [pos, cols, rows, blocked],
  );

  const goToFurniture = useCallback(
    (f: PlacedFurniture) => {
      setSeat(null);
      const route = nearestFreeNeighbor(pos, f, cols, rows, blocked);
      if (!route) return;
      pendingSeat.current = f;
      if (route.path.length === 0) {
        // já está ao lado
        setPath([]);
        if (FURNITURE_SPRITES[f.asset]?.sittable) {
          setSeat(f);
          setFacing("left");
        }
        pendingSeat.current = null;
      } else {
        setPath(route.path);
      }
    },
    [pos, cols, rows, blocked],
  );

  const onTile = (x: number, y: number) => (editMode ? onEditTileClick?.(x, y) : walkTo({ x, y }));
  const onFurniture = (f: PlacedFurniture) => {
    if (editMode) return onEditFurnitureClick?.(f.uid);
    if (!FURNITURE_SPRITES[f.asset]?.blocking) return walkTo(f); // tapete: pisa em cima
    goToFurniture(f);
  };

  // ---- Geometria das paredes
  const top = gridToScreen(geom, 0, 0);
  const rightFloor = gridToScreen(geom, cols, 0);
  const leftFloor = gridToScreen(geom, 0, rows);
  const leftWallPt = (gy: number, z: number) => {
    const p = gridToScreen(geom, 0, gy);
    return `${p.x},${p.y - z}`;
  };
  const rightWallPt = (gx: number, z: number) => {
    const p = gridToScreen(geom, gx, 0);
    return `${p.x},${p.y - z}`;
  };
  const board = { g0: rows * 0.22, g1: rows * 0.22 + 1.6, z0: 42, z1: 96 };
  const win = { g0: cols * 0.35, g1: cols * 0.35 + 1.6, z0: 46, z1: 100 };

  const avatarPose: AvatarPose = seat ? "sit" : path.length ? "walk" : "stand";
  const avatarTile = seat ?? pos;
  const avatarCenter = tileCenter(geom, avatarTile.x, avatarTile.y);
  const seatLift = seat ? FURNITURE_SPRITES[seat.asset]?.seatZ ?? 12 : 0;

  return (
    <div className="relative select-none" style={{ width: geom.width, height: geom.height }}>
      {/* Paredes, piso, sujeira e quadro de troféus */}
      <svg width={geom.width} height={geom.height} className="absolute inset-0 overflow-visible" style={{ zIndex: 0 }}>
        {/* parede esquerda */}
        <polygon
          points={`${top.x},${top.y - WALL_H} ${top.x},${top.y} ${leftFloor.x},${leftFloor.y} ${leftFloor.x},${leftFloor.y - WALL_H}`}
          fill="#d9cfb6"
          stroke="#8f8468"
          strokeWidth={1}
        />
        {/* parede direita */}
        <polygon
          points={`${top.x},${top.y - WALL_H} ${rightFloor.x},${rightFloor.y - WALL_H} ${rightFloor.x},${rightFloor.y} ${top.x},${top.y}`}
          fill="#bfb398"
          stroke="#8f8468"
          strokeWidth={1}
        />
        {/* rodapés */}
        <polygon points={`${leftWallPt(0, 8)} ${leftWallPt(rows, 8)} ${leftWallPt(rows, 0)} ${leftWallPt(0, 0)}`} fill="#8f6a44" />
        <polygon points={`${rightWallPt(0, 8)} ${rightWallPt(cols, 8)} ${rightWallPt(cols, 0)} ${rightWallPt(0, 0)}`} fill="#7a5a39" />
        {/* topo das paredes */}
        <polyline
          points={`${leftFloor.x},${leftFloor.y - WALL_H} ${top.x},${top.y - WALL_H} ${rightFloor.x},${rightFloor.y - WALL_H}`}
          fill="none"
          stroke="#efe6cf"
          strokeWidth={4}
        />

        {/* janela */}
        <polygon
          points={`${rightWallPt(win.g0, win.z1)} ${rightWallPt(win.g1, win.z1)} ${rightWallPt(win.g1, win.z0)} ${rightWallPt(win.g0, win.z0)}`}
          fill="#7cc4f0"
          stroke="#f3e9d2"
          strokeWidth={4}
        />
        <line
          x1={Number(rightWallPt((win.g0 + win.g1) / 2, win.z1).split(",")[0])}
          y1={Number(rightWallPt((win.g0 + win.g1) / 2, win.z1).split(",")[1])}
          x2={Number(rightWallPt((win.g0 + win.g1) / 2, win.z0).split(",")[0])}
          y2={Number(rightWallPt((win.g0 + win.g1) / 2, win.z0).split(",")[1])}
          stroke="#f3e9d2"
          strokeWidth={3}
        />

        {/* Quadro de Troféus / Estatísticas */}
        <g
          role="button"
          tabIndex={0}
          aria-label="Abrir quadro de troféus e estatísticas"
          className="cursor-pointer outline-none [&:hover>polygon:first-child]:fill-[#7a4f2a] [&:focus-visible>polygon:first-child]:stroke-gold"
          onClick={onTrophyClick}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onTrophyClick()}
        >
          <polygon
            points={`${leftWallPt(board.g0, board.z1)} ${leftWallPt(board.g1, board.z1)} ${leftWallPt(board.g1, board.z0)} ${leftWallPt(board.g0, board.z0)}`}
            fill="#5e3c20"
            stroke="#f2b84b"
            strokeWidth={3}
          />
          {(() => {
            const c = gridToScreen(geom, 0, (board.g0 + board.g1) / 2);
            const cy = c.y - (board.z0 + board.z1) / 2;
            return (
              <g transform={`translate(${c.x} ${cy}) skewY(-26.565)`}>
                <rect x={-7} y={-14} width={14} height={10} fill="#f2b84b" />
                <rect x={-11} y={-13} width={4} height={6} fill="#f2b84b" />
                <rect x={7} y={-13} width={4} height={6} fill="#f2b84b" />
                <rect x={-2} y={-4} width={4} height={6} fill="#c98f2a" />
                <rect x={-6} y={2} width={12} height={3} fill="#c98f2a" />
                <text x={0} y={16} textAnchor="middle" fontSize={7} fill="#f3e9d2" fontFamily="var(--font-pixel)">
                  STATS
                </text>
              </g>
            );
          })()}
        </g>

        {/* piso clicável */}
        {Array.from({ length: rows }).map((_, y) =>
          Array.from({ length: cols }).map((__, x) => {
            const a = gridToScreen(geom, x, y);
            const b = gridToScreen(geom, x + 1, y);
            const c = gridToScreen(geom, x + 1, y + 1);
            const d = gridToScreen(geom, x, y + 1);
            const even = (x + y) % 2 === 0;
            return (
              <polygon
                key={`${x}-${y}`}
                points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`}
                fill={even ? "#cbb48a" : "#bea47a"}
                stroke="#a08659"
                strokeWidth={0.8}
                className={`cursor-pointer transition-[fill] ${editMode ? "hover:fill-[#9ed9b8]" : "hover:fill-[#e2cfa6]"}`}
                onClick={() => onTile(x, y)}
              />
            );
          }),
        )}

        <DirtLayer geom={geom} level={level} />
      </svg>

      {/* Mobília */}
      {furniture.map((f) => {
        const def = FURNITURE_SPRITES[f.asset];
        if (!def) return null;
        const c = tileCenter(geom, f.x, f.y);
        const selected = selectedUid === f.uid;
        return (
          <div
            key={f.uid}
            className="pointer-events-none absolute"
            style={{ left: c.x - 32, top: c.y - def.height, zIndex: def.blocking ? depth(f.x, f.y) : 1 }}
            title={f.name}
          >
            <svg
              width={64}
              height={def.height + 18}
              viewBox={`-32 ${-def.height} 64 ${def.height + 18}`}
              className="block overflow-visible"
              style={{ filter: selected ? "drop-shadow(0 0 4px #f2b84b) brightness(1.15)" : undefined }}
            >
              <g className="pointer-events-auto cursor-pointer" onClick={() => onFurniture(f)}>
                {def.render()}
              </g>
            </svg>
          </div>
        );
      })}

      {/* Dono do quarto (quando visitando) */}
      {host && hostTile && (
        <AvatarOnTile geom={geom} tile={hostTile} config={host.config} nickname={host.nickname} pose="stand" facing="right" frame={0} lift={0} />
      )}

      {/* Avatar do jogador */}
      <AvatarOnTile
        geom={geom}
        tile={avatarTile}
        config={player.config}
        nickname={player.nickname}
        pose={avatarPose}
        facing={facing}
        frame={frame}
        lift={seatLift}
        center={avatarCenter}
        highlight
      />

      <CreepyLayer geom={geom} level={level} />
    </div>
  );
}

function AvatarOnTile({
  geom,
  tile,
  config,
  nickname,
  pose,
  facing,
  frame,
  lift,
  center,
  highlight,
}: {
  geom: ReturnType<typeof roomGeometry>;
  tile: Point;
  config: AvatarConfig;
  nickname: string;
  pose: AvatarPose;
  facing: "left" | "right";
  frame: 0 | 1;
  lift: number;
  center?: Point;
  highlight?: boolean;
}) {
  const c = center ?? tileCenter(geom, tile.x, tile.y);
  const height = 56;
  return (
    <div
      className="pointer-events-none absolute flex flex-col items-center"
      style={{
        left: c.x - 30,
        top: c.y - height - 14 - lift + (pose === "sit" ? 6 : 0),
        width: 60,
        zIndex: depth(tile.x, tile.y, 5),
        transition: `left ${STEP_MS}ms linear, top ${STEP_MS}ms linear`,
      }}
    >
      <span
        className={`mb-0.5 whitespace-nowrap rounded px-1 text-[9px] leading-tight ${
          highlight ? "bg-gold text-night" : "bg-night/80 text-cream"
        }`}
      >
        @{nickname}
      </span>
      <Avatar config={config} pose={pose} frame={frame} facing={facing} size={height} />
      {pose !== "sit" && <div className="-mt-1.5 h-2 w-6 rounded-[50%] bg-black/25" />}
    </div>
  );
}
