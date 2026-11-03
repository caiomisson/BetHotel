"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { depth, findPath, gridToScreen, roomGeometry, tileCenter, tileKey, type Point } from "@/lib/iso";
import type { AvatarConfig, RoomDecor } from "@/lib/types";
import { Avatar, type AvatarPose } from "./Avatar";
import { CreepyLayer, DirtLayer, dirtLevel } from "./DirtOverlay";
import { RoomLight } from "./RoomLight";
import { RoomWalls, WALL_ITEM_Z, wallFeatures } from "./RoomWalls";
import { footprint, FURNITURE_SPRITES, FurnitureSvg, spriteBox } from "./sprites";

export interface PlacedFurniture {
  uid: string;
  asset: string;
  name: string;
  x: number;
  y: number;
  rot: 0 | 1;
}

export interface RoomAvatar {
  nickname: string;
  config: AvatarConfig;
}

interface IsoRoomProps {
  cols: number;
  rows: number;
  cleanliness: number;
  decor: RoomDecor;
  roomNumber: number | null;
  /** Vitórias do dono: a Estante de Troféus mostra um troféu por vitória. */
  trophies: number;
  furniture: PlacedFurniture[];
  /** Avatar controlado pelo usuário logado. */
  player: RoomAvatar;
  /** Dono do quarto, exibido parado quando alguém está visitando. */
  host?: RoomAvatar;
  onStatsClick: () => void;
  editMode?: boolean;
  selectedUid?: string | null;
  onEditTileClick?: (x: number, y: number) => void;
  onEditFurnitureClick?: (uid: string) => void;
  /** Mostra os encaixes da parede (item de parede selecionado no modo decorar). */
  wallSlots?: boolean;
}

const SKEW = 26.565;

const STEP_MS = 230;
const DIRS: Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/** Pisos ocupados por um móvel posicionado. */
export function tilesOf(f: { asset: string; x: number; y: number; rot: 0 | 1 }): Point[] {
  const def = FURNITURE_SPRITES[f.asset];
  if (!def) return [];
  const { w, d } = footprint(def, f.rot);
  const out: Point[] = [];
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) out.push({ x: f.x + i, y: f.y + j });
  return out;
}

interface Seat {
  furniture: PlacedFurniture;
  tile: Point;
}

export function IsoRoom({
  cols,
  rows,
  cleanliness,
  decor,
  roomNumber,
  trophies,
  furniture,
  player,
  host,
  onStatsClick,
  editMode,
  selectedUid,
  onEditTileClick,
  onEditFurnitureClick,
  wallSlots,
}: IsoRoomProps) {
  const geom = useMemo(() => roomGeometry(cols, rows), [cols, rows]);
  const level = dirtLevel(cleanliness);

  // ---- Ocupação do grid (tapetes não bloqueiam)
  const blocked = useMemo(() => {
    const s = new Set<string>();
    furniture.forEach((f) => FURNITURE_SPRITES[f.asset]?.layer === "solid" && tilesOf(f).forEach((t) => s.add(tileKey(t))));
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
  const [seat, setSeat] = useState<Seat | null>(null);
  const pendingTarget = useRef<PlacedFurniture | null>(null);

  useEffect(() => {
    if (!seat && blocked.has(tileKey(pos)) && freeTiles[0]) setPos(freeTiles[0]);
  }, [blocked, freeTiles, pos, seat]);

  /** Chegou ao lado do móvel: senta, abre estatísticas ou só olha para ele. */
  const arriveAt = useCallback(
    (f: PlacedFurniture, from: Point) => {
      const def = FURNITURE_SPRITES[f.asset];
      const tiles = tilesOf(f);
      const touching = tiles.find((t) => Math.abs(t.x - from.x) + Math.abs(t.y - from.y) === 1) ?? tiles[0];
      if (def?.sittable) {
        setSeat({ furniture: f, tile: touching });
        setFacing(f.rot ? "right" : "left");
        return;
      }
      setFacing(touching.x - from.x > 0 || touching.y - from.y < 0 ? "right" : "left");
      if (def?.opensStats) onStatsClick();
    },
    [onStatsClick],
  );

  // ---- Loop de caminhada
  useEffect(() => {
    if (path.length === 0) return;
    const t = setTimeout(() => {
      const [next, ...rest] = path;
      setFacing(next.x - pos.x > 0 || next.y - pos.y < 0 ? "right" : "left");
      setPos(next);
      setFrame((f) => (f === 0 ? 1 : 0));
      setPath(rest);
      if (rest.length === 0 && pendingTarget.current) {
        const target = pendingTarget.current;
        pendingTarget.current = null;
        setTimeout(() => arriveAt(target, next), STEP_MS);
      }
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [path, pos, arriveAt]);

  const walkTo = useCallback(
    (goal: Point) => {
      pendingTarget.current = null;
      setSeat(null);
      const p = findPath(pos, goal, cols, rows, blocked);
      if (p) setPath(p);
    },
    [pos, cols, rows, blocked],
  );

  const goToFurniture = useCallback(
    (f: PlacedFurniture) => {
      setSeat(null);
      const start = pos;
      const tiles = new Set(tilesOf(f).map(tileKey));
      // vizinho livre mais próximo de qualquer piso do móvel
      let best: Point[] | null = null;
      tilesOf(f).forEach((t) =>
        DIRS.forEach((d) => {
          const n = { x: t.x + d.x, y: t.y + d.y };
          if (n.x < 0 || n.y < 0 || n.x >= cols || n.y >= rows) return;
          if (tiles.has(tileKey(n)) || blocked.has(tileKey(n))) return;
          const p = findPath(start, n, cols, rows, blocked);
          if (p && (!best || p.length < best.length)) best = p;
        }),
      );
      const route = best as Point[] | null;
      if (!route) return;
      if (route.length === 0) {
        setPath([]);
        arriveAt(f, start);
      } else {
        pendingTarget.current = f;
        setPath(route);
      }
    },
    [pos, cols, rows, blocked, arriveAt],
  );

  const onTile = (x: number, y: number) => (editMode ? onEditTileClick?.(x, y) : walkTo({ x, y }));
  const onFurniture = (f: PlacedFurniture) => {
    if (editMode) return onEditFurnitureClick?.(f.uid);
    const layer = FURNITURE_SPRITES[f.asset]?.layer;
    if (layer === "floor") return walkTo({ x: f.x, y: f.y });
    if (layer === "table") {
      const t = tableUnder(f.x, f.y);
      return t && goToFurniture(t);
    }
    goToFurniture(f);
  };

  // ---- Avatar
  const avatarPose: AvatarPose = seat ? "sit" : path.length ? "walk" : "stand";
  const avatarTile = seat?.tile ?? pos;
  const seatLift = seat ? FURNITURE_SPRITES[seat.furniture.asset]?.seatZ ?? 12 : 0;

  // ---- Itens de parede e de mesa
  const wallItems = furniture.filter((f) => FURNITURE_SPRITES[f.asset]?.layer === "wall");
  const surfaces = furniture.filter((f) => FURNITURE_SPRITES[f.asset]?.surface);
  const tableUnder = (x: number, y: number) => surfaces.find((t) => tilesOf(t).some((p) => p.x === x && p.y === y));
  const features = wallFeatures(cols, rows);
  const slotFree = (side: "l" | "r", i: number) => {
    const [a, b] = side === "l" ? features.window : features.plaque;
    return i + 1 <= a + 0.05 || i >= b - 0.05;
  };
  const wallAnchor = (f: { x: number; y: number }) => {
    const right = f.y === -1;
    const p = right ? gridToScreen(geom, f.x + 0.5, 0) : gridToScreen(geom, 0, f.y + 0.5);
    return { x: p.x, y: p.y - WALL_ITEM_Z, skew: right ? SKEW : -SKEW };
  };
  const wallPt = (side: "l" | "r", g: number, z: number) => {
    const p = side === "r" ? gridToScreen(geom, g, 0) : gridToScreen(geom, 0, g);
    return `${p.x},${p.y - z}`;
  };

  // ---- Laje do piso
  const bottom = gridToScreen(geom, cols, rows);
  const leftFloor = gridToScreen(geom, 0, rows);
  const rightFloor = gridToScreen(geom, cols, 0);
  const SLAB = 10;

  return (
    <div className="relative select-none" style={{ width: geom.width, height: geom.height }}>
      <svg width={geom.width} height={geom.height} className="absolute inset-0 overflow-visible" style={{ zIndex: 0 }}>
        <RoomWalls geom={geom} decor={decor} roomNumber={roomNumber} onStatsClick={onStatsClick} />

        {/* laje (espessura do piso) */}
        <polygon
          points={`${leftFloor.x},${leftFloor.y} ${bottom.x},${bottom.y} ${bottom.x},${bottom.y + SLAB} ${leftFloor.x},${leftFloor.y + SLAB}`}
          fill="#4a3520"
        />
        <polygon
          points={`${bottom.x},${bottom.y} ${rightFloor.x},${rightFloor.y} ${rightFloor.x},${rightFloor.y + SLAB} ${bottom.x},${bottom.y + SLAB}`}
          fill="#3a2a19"
        />

        {/* piso xadrez clicável */}
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
                fill={even ? "#9c774c" : "#8a6741"}
                stroke="#6e5232"
                strokeWidth={0.8}
                className={`cursor-pointer transition-[fill] ${editMode ? "hover:fill-[#9ed9b8]" : "hover:fill-[#b38c5c]"}`}
                onClick={() => onTile(x, y)}
              />
            );
          }),
        )}
        {/* sombra da parede sobre o piso */}
        <polygon
          points={`${gridToScreen(geom, 0, 0).x},${gridToScreen(geom, 0, 0).y} ${rightFloor.x},${rightFloor.y} ${gridToScreen(geom, cols, 0.35).x},${gridToScreen(geom, cols, 0.35).y} ${gridToScreen(geom, 0.35, 0.35).x},${gridToScreen(geom, 0.35, 0.35).y} ${gridToScreen(geom, 0.35, rows).x},${gridToScreen(geom, 0.35, rows).y} ${leftFloor.x},${leftFloor.y}`}
          fill="#000"
          opacity={0.08}
          pointerEvents="none"
        />

        <DirtLayer geom={geom} level={level} />
      </svg>

      {/* Itens pendurados na parede */}
      <svg width={geom.width} height={geom.height} className="pointer-events-none absolute inset-0 overflow-visible" style={{ zIndex: 1 }}>
        {wallItems.map((f) => {
          const a = wallAnchor(f);
          const def = FURNITURE_SPRITES[f.asset];
          return (
            <g
              key={f.uid}
              transform={`translate(${a.x} ${a.y}) skewY(${a.skew}) scale(0.76)`}
              className={editMode ? "pointer-events-auto cursor-pointer" : undefined}
              style={{ filter: selectedUid === f.uid ? "drop-shadow(0 0 3px #f2b84b) brightness(1.15)" : "drop-shadow(1px 2px 0 rgba(0,0,0,.35))" }}
              onClick={() => editMode && onEditFurnitureClick?.(f.uid)}
            >
              <title>{f.name}</title>
              {def.render({ rot: 0 }, {})}
            </g>
          );
        })}
        {wallSlots &&
          (["l", "r"] as const).flatMap((side) =>
            Array.from({ length: side === "l" ? rows : cols }).map((_, i) =>
              slotFree(side, i) ? (
                <polygon
                  key={`${side}${i}`}
                  points={`${wallPt(side, i + 0.08, WALL_ITEM_Z + 22)} ${wallPt(side, i + 0.92, WALL_ITEM_Z + 22)} ${wallPt(side, i + 0.92, WALL_ITEM_Z - 22)} ${wallPt(side, i + 0.08, WALL_ITEM_Z - 22)}`}
                  className="pointer-events-auto cursor-pointer fill-mint/15 stroke-mint hover:fill-mint/35"
                  strokeWidth={1.2}
                  strokeDasharray="3 2"
                  onClick={() => onEditTileClick?.(side === "l" ? -1 : i, side === "l" ? i : -1)}
                />
              ) : null,
            ),
          )}
      </svg>

      {/* Mobília */}
      {furniture.map((f) => {
        const def = FURNITURE_SPRITES[f.asset];
        if (!def || def.layer === "wall") return null;
        if (def.layer === "table") {
          const table = tableUnder(f.x, f.y);
          if (!table) return null;
          const tdef = FURNITURE_SPRITES[table.asset];
          const tfp = footprint(tdef, table.rot);
          const c = tileCenter(geom, f.x, f.y);
          const tb = spriteBox(def, 0);
          return (
            <div
              key={f.uid}
              className="pointer-events-none absolute"
              style={{ left: c.x + tb.x, top: c.y + tb.y - (tdef.surface ?? 0), zIndex: depth(table.x + tfp.w - 1, table.y + tfp.d - 1, 3) }}
              title={f.name}
            >
              <FurnitureSvg asset={f.asset} glow={selectedUid === f.uid} onClick={() => onFurniture(f)} />
            </div>
          );
        }
        const { w, d } = footprint(def, f.rot);
        const center = gridToScreen(geom, f.x + w / 2, f.y + d / 2);
        const box = spriteBox(def, f.rot);
        return (
          <div
            key={f.uid}
            className="pointer-events-none absolute"
            style={{
              left: center.x + box.x,
              top: center.y + box.y,
              zIndex: def.layer === "floor" ? 2 : depth(f.x + w - 1, f.y + d - 1),
            }}
            title={f.name}
          >
            <FurnitureSvg asset={f.asset} rot={f.rot} glow={selectedUid === f.uid} trophies={trophies} onClick={() => onFurniture(f)} />
          </div>
        );
      })}

      {host && hostTile && (
        <AvatarOnTile geom={geom} tile={hostTile} config={host.config} nickname={host.nickname} pose="stand" facing="right" frame={0} lift={0} />
      )}

      <AvatarOnTile
        geom={geom}
        tile={avatarTile}
        config={player.config}
        nickname={player.nickname}
        pose={avatarPose}
        facing={facing}
        frame={frame}
        lift={seatLift}
        highlight
      />

      <RoomLight geom={geom} mode={decor.light} />
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
  highlight?: boolean;
}) {
  const c = tileCenter(geom, tile.x, tile.y);
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
      <span className={`mb-0.5 whitespace-nowrap rounded px-1 font-pixel text-[7px] leading-tight ${highlight ? "bg-gold text-night" : "bg-night/80 text-cream"}`}>
        @{nickname}
      </span>
      <Avatar config={config} pose={pose} frame={frame} facing={facing} size={height} />
      {pose !== "sit" && <div className="-mt-1.5 h-2.5 w-7 rounded-[50%] bg-black/25 blur-[1px]" />}
    </div>
  );
}
