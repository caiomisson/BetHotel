// Matemática da grade isométrica 2:1 e pathfinding do avatar.

export const TILE_W = 64;
export const TILE_H = 32;
export const HALF_W = TILE_W / 2;
export const HALF_H = TILE_H / 2;
export const WALL_H = 120;

export interface Point {
  x: number;
  y: number;
}

export interface RoomGeometry {
  cols: number;
  rows: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export function roomGeometry(cols: number, rows: number): RoomGeometry {
  const originX = rows * HALF_W;
  const originY = WALL_H + 8;
  return {
    cols,
    rows,
    originX,
    originY,
    width: (cols + rows) * HALF_W,
    height: originY + (cols + rows) * HALF_H + 12,
  };
}

/** Converte um ponto da grade (pode ser fracionário) para pixels na tela. */
export function gridToScreen(g: RoomGeometry, gx: number, gy: number): Point {
  return { x: g.originX + (gx - gy) * HALF_W, y: g.originY + (gx + gy) * HALF_H };
}

/** Centro do piso (x, y). */
export function tileCenter(g: RoomGeometry, x: number, y: number): Point {
  return gridToScreen(g, x + 0.5, y + 0.5);
}

/** Ordem de desenho: quem está mais "à frente" fica por cima. */
export function depth(x: number, y: number, layer = 0): number {
  return (x + y) * 10 + layer + 10;
}

const key = (p: Point) => `${p.x},${p.y}`;
const DIRS: Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/** BFS em 4 direções. Retorna o caminho sem o ponto inicial, ou null. */
export function findPath(
  start: Point,
  goal: Point,
  cols: number,
  rows: number,
  blocked: Set<string>,
): Point[] | null {
  if (start.x === goal.x && start.y === goal.y) return [];
  const prev = new Map<string, Point | null>([[key(start), null]]);
  const queue: Point[] = [start];

  while (queue.length) {
    const cur = queue.shift()!;
    for (const d of DIRS) {
      const next = { x: cur.x + d.x, y: cur.y + d.y };
      const k = key(next);
      if (next.x < 0 || next.y < 0 || next.x >= cols || next.y >= rows) continue;
      if (prev.has(k)) continue;
      const isGoal = next.x === goal.x && next.y === goal.y;
      if (blocked.has(k) && !isGoal) continue;
      prev.set(k, cur);
      if (isGoal) {
        const path: Point[] = [];
        let p: Point | null = next;
        while (p && !(p.x === start.x && p.y === start.y)) {
          path.unshift(p);
          p = prev.get(key(p)) ?? null;
        }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

/** Vizinho livre mais próximo de um alvo (para chegar até um móvel). */
export function nearestFreeNeighbor(
  from: Point,
  target: Point,
  cols: number,
  rows: number,
  blocked: Set<string>,
): { tile: Point; path: Point[] } | null {
  let best: { tile: Point; path: Point[] } | null = null;
  for (const d of DIRS) {
    const n = { x: target.x + d.x, y: target.y + d.y };
    if (n.x < 0 || n.y < 0 || n.x >= cols || n.y >= rows || blocked.has(key(n))) continue;
    const path = findPath(from, n, cols, rows, blocked);
    if (path && (!best || path.length < best.path.length)) best = { tile: n, path };
  }
  return best;
}

export const tileKey = key;

/** Pseudo-aleatório determinístico (para posicionar sujeira sempre no mesmo lugar). */
export function hash01(x: number, y: number, seed = 1): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
