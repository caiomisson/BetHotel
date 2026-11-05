import { shade } from "@/lib/color";
import type { AvatarConfig } from "@/lib/types";

export type AvatarPose = "stand" | "walk" | "sit";
/** Direções isométricas: se/sw = de frente; ne/nw = de costas. */
export type AvatarDir = "se" | "sw" | "ne" | "nw";

interface AvatarProps {
  config: AvatarConfig;
  pose?: AvatarPose;
  /** Alterna 0/1 durante a caminhada. */
  frame?: 0 | 1;
  /** Compatibilidade: right = se, left = sw. */
  facing?: "left" | "right";
  dir?: AvatarDir;
  /** Altura em px. */
  size?: number;
}

/** Grade do sprite em "pixels de arte". */
export const AVATAR_W = 24;
export const AVATAR_H = 42;
/** Linha (em pixels de arte) dos pés em pé e do quadril sentado. */
export const AVATAR_FEET_Y = 40;
export const AVATAR_HIP_Y = 30;

const OY = 3; // folga no topo para coroa/espetos
const OUTLINE = "#15111c";

type Rect = { x: number; y: number; w: number; h: number; c: string; shade: boolean };

/**
 * Avatar chibi (≈3,2 cabeças) em paperdoll, com camadas na ordem:
 * corpo base → rosto → cabelo/chapéu → camisa → calça → acessórios.
 * Luz fixa vinda do alto à esquerda: coluna esquerda clara, direita escura.
 * O contorno escuro de 1px é gerado em volta da silhueta.
 */
export function Avatar({ config, pose = "stand", frame = 0, facing = "right", dir, size = 56 }: AvatarProps) {
  const d: AvatarDir = dir ?? (facing === "left" ? "sw" : "se");
  const back = d === "ne" || d === "nw";
  const mirror = d === "sw" || d === "nw"; // olhando para a esquerda da tela
  const c = config;
  const fat = c.body === "gordo";
  const sit = pose === "sit";
  const step = pose === "walk" ? (frame === 0 ? 1 : -1) : 0;

  const skin = c.skin;
  const hair = c.hairColor;
  const shirt = c.shirtColor;
  const pants = c.pantsColor;
  const shoe = "#2b2b33";

  const body: Rect[] = [];
  const face: Rect[] = [];
  const hairL: Rect[] = [];
  const top: Rect[] = [];
  const bottom: Rect[] = [];
  const acc: Rect[] = [];
  const R = (L: Rect[], x: number, y: number, w: number, h: number, col: string, sh = true) => L.push({ x, y: y + OY, w, h, c: col, shade: sh });

  // ---------------- medidas
  const torsoX = fat ? 4 : 6;
  const torsoW = fat ? 16 : 12;
  const torsoH = fat ? 11 : 10;
  const armL = fat ? 2 : 4;
  const armR = fat ? 20 : 18;
  const hipX = fat ? 5 : 7;
  const hipW = fat ? 14 : 10;
  const legW = fat ? 5 : 4;
  const legLX = fat ? 6 : 7;
  const legRX = 13;
  const legTop = 28;
  const legBottom = sit ? 30 : 34; // sentado: canela curta (joelho dobrado)

  // ---------------- 1. corpo base
  R(body, 6, 2, 12, 12, skin); // cabeça
  if (fat) {
    R(body, 5, 8, 1, 5, skin); // bochechas
    R(body, 18, 8, 1, 5, skin);
    R(body, 7, 14, 10, 1, skin); // papada
  }
  if (!back) {
    R(body, 5, 7, 1, 2, skin, false); // orelhas
    R(body, 18, 7, 1, 2, skin, false);
  }
  R(body, 10, 14, 4, 1, shade(skin, -0.15), false); // pescoço
  R(body, armL, 15 - step, 2, 9, skin); // braços (balançam ao andar)
  R(body, armR, 15 + step, 2, 9, skin);
  R(body, armL, 24 - step, 2, 2, skin); // mãos
  R(body, armR, 24 + step, 2, 2, skin);
  R(body, torsoX, 15, torsoW, torsoH, skin);

  // ---------------- 2. rosto (só de frente)
  if (!back) {
    const eye = "#1d1d24";
    R(face, 12, 8, 1, 2, eye, false);
    R(face, 15, 8, 1, 2, eye, false);
    R(face, 12, 8, 1, 1, "#ffffff", false);
    R(face, 15, 8, 1, 1, "#ffffff", false);
    R(face, 13, 11, 2, 1, shade(skin, -0.35), false); // boca
    if (fat) R(face, 16, 10, 2, 1, shade(skin, -0.12), false); // bochecha corada
  }

  // ---------------- 3. cabelo / chapéu
  if (c.hair !== "bald") {
    if (back) {
      R(hairL, 6, 1, 12, c.hair === "long" ? 14 : 10, hair);
    } else {
      R(hairL, 6, 1, 12, 3, hair); // topo
      R(hairL, 6, 4, 3, 4, hair); // lateral de trás
      R(hairL, 9, 4, 8, 1, hair); // franja
      if (c.hair === "long") {
        R(hairL, 5, 5, 3, 11, hair);
        R(hairL, 17, 4, 1, 6, hair);
      }
    }
    if (c.hair === "spiky") {
      [7, 10, 13, 16].forEach((x) => R(hairL, x, 0, 2, 1, hair, false));
      R(hairL, 11, -1, 2, 1, hair, false);
    }
  }
  if (c.hat === "cap") {
    const cc = c.hatColor ?? "#d24b3e";
    R(hairL, 6, 0, 12, 4, cc);
    R(hairL, 6, 0, 5, 1, shade(cc, 0.25), false);
    if (!back) R(hairL, 15, 4, 6, 1, shade(cc, -0.25), false); // aba para a frente
    else R(hairL, 10, 4, 4, 1, shade(cc, -0.3), false); // ajuste traseiro
  }
  if (c.hat === "crown") {
    const g = "#f2b84b";
    R(hairL, 7, -1, 10, 3, g);
    [7, 11, 15].forEach((x) => R(hairL, x, -3, 2, 2, g, false));
    if (!back) R(hairL, 11, 0, 2, 1, "#ef6b5b", false);
  }

  // ---------------- 4. camisa
  const sleeve = c.shirt === "hoodie" ? 9 : c.shirt === "tshirt" ? 4 : 0;
  if (c.shirt === "tank") {
    R(top, torsoX + 2, 15, torsoW - 4, torsoH, shirt);
    R(top, torsoX, 17, 2, torsoH - 2, shirt);
    R(top, torsoX + torsoW - 2, 17, 2, torsoH - 2, shirt);
  } else {
    R(top, torsoX, 15, torsoW, torsoH, shirt);
  }
  if (sleeve) {
    R(top, armL, 15 - step, 2, sleeve, shirt);
    R(top, armR, 15 + step, 2, sleeve, shirt);
  }
  if (c.shirt === "hoodie") {
    if (back) {
      R(top, 8, 14, 8, 5, shade(shirt, -0.18));
    } else {
      R(top, 7, 13, 10, 2, shade(shirt, -0.18), false); // capuz atrás do pescoço
      R(top, 10, 15, 1, 4, "#f3e9d2", false); // cordões
      R(top, 13, 15, 1, 4, "#f3e9d2", false);
      R(top, torsoX + 3, 21, torsoW - 6, 3, shade(shirt, -0.15), false); // bolso
    }
  }
  if (fat && !back) R(top, torsoX + torsoW - 5, 19, 4, 4, shade(shirt, 0.1), false); // barriga

  // ---------------- 5. calça + sapatos
  R(bottom, hipX, 25, hipW, 3, pants);
  const leg = (x: number, lift: number) => {
    const top0 = legTop - lift;
    if (c.pants === "shorts") {
      R(bottom, x, top0, legW, 3, pants);
      R(body, x + 1, top0 + 3, legW - 2, Math.max(1, legBottom - top0 - 2), skin); // canela
    } else {
      R(bottom, x, top0, legW, legBottom - top0 + 1, pants);
    }
    R(bottom, x, legBottom + 1 - lift, legW, 2, shoe, false);
    if (!back) R(bottom, x + legW - 1, legBottom + 2 - lift, 2, 1, shoe, false); // bico do sapato
  };
  leg(legLX, step > 0 ? 1 : 0);
  leg(legRX, step < 0 ? 1 : 0);

  // ---------------- 6. acessórios
  if (c.glasses === "sunglasses" && !back) {
    R(acc, 11, 8, 3, 2, "#15161c", false);
    R(acc, 14, 8, 3, 2, "#15161c", false);
    R(acc, 9, 8, 2, 1, "#15161c", false);
    R(acc, 12, 8, 1, 1, "#4a6a9a", false);
    R(acc, 15, 8, 1, 1, "#4a6a9a", false);
  }

  // ---------------- composição: espelha, sombreia (luz à esquerda), contorna
  const grid = new Map<string, string>();
  for (const L of [body, face, hairL, top, bottom, acc]) {
    for (const r of L) {
      const x0 = mirror ? AVATAR_W - r.x - r.w : r.x;
      for (let i = 0; i < r.w; i++) {
        for (let j = 0; j < r.h; j++) {
          const x = x0 + i;
          const y = r.y + j;
          if (x < 0 || y < 0 || x >= AVATAR_W || y >= AVATAR_H) continue;
          let col = r.c;
          if (r.shade && r.w > 1) {
            if (i === 0) col = shade(r.c, 0.14);
            else if (i === r.w - 1) col = shade(r.c, -0.2);
          }
          if (r.shade && r.h > 3 && j === r.h - 1) col = shade(col, -0.12);
          grid.set(`${x},${y}`, col);
        }
      }
    }
  }
  const outline = new Set<string>();
  for (const k of grid.keys()) {
    const [x, y] = k.split(",").map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nk = `${x + dx},${y + dy}`;
      if (!grid.has(nk)) outline.add(nk);
    }
  }

  return (
    <svg width={(size * AVATAR_W) / AVATAR_H} height={size} viewBox={`0 0 ${AVATAR_W} ${AVATAR_H}`} className="crisp block overflow-visible" aria-hidden>
      {[...outline].map((k) => {
        const [x, y] = k.split(",").map(Number);
        return <rect key={`o${k}`} x={x} y={y} width={1} height={1} fill={OUTLINE} />;
      })}
      {[...grid.entries()].map(([k, col]) => {
        const [x, y] = k.split(",").map(Number);
        return <rect key={k} x={x} y={y} width={1} height={1} fill={col} />;
      })}
    </svg>
  );
}
