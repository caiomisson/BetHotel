import { shade } from "@/lib/color";
import type { AvatarConfig } from "@/lib/types";

export type AvatarPose = "stand" | "walk" | "sit";

interface AvatarProps {
  config: AvatarConfig;
  pose?: AvatarPose;
  /** Alterna 0/1 durante a caminhada. */
  frame?: 0 | 1;
  facing?: "left" | "right";
  /** Altura em px (largura = metade). */
  size?: number;
}

type Px = [x: number, y: number, w: number, h: number, fill: string];

/**
 * Avatar em pixel art original (grade 16x32), montado por camadas:
 * cabelo, cabeça, camisa, calça, sapatos e acessórios premium.
 */
export function Avatar({ config, pose = "stand", frame = 0, facing = "right", size = 56 }: AvatarProps) {
  const c = config;
  const skin = c.skin;
  const skinDark = shade(skin, -0.18);
  const shirt = c.shirtColor;
  const shirtDark = shade(shirt, -0.25);
  const pants = c.pantsColor;
  const pantsDark = shade(pants, -0.25);
  const hair = c.hairColor;
  const shoe = "#2b2b33";
  const sitting = pose === "sit";
  const dy = sitting ? 5 : 0; // tronco desce ao sentar
  const swing = pose === "walk" ? (frame === 0 ? 1 : -1) : 0;
  /** Biotipo "Gordo": tronco, braços e pernas mais largos, bochecha e barriga. */
  const fat = c.body === "gordo";

  const px: Px[] = [];
  const add = (x: number, y: number, w: number, h: number, fill: string) => px.push([x, y + dy, w, h, fill]);
  const addAbs = (x: number, y: number, w: number, h: number, fill: string) => px.push([x, y, w, h, fill]);

  // --- Capuz (atrás da cabeça)
  if (c.shirt === "hoodie") add(3, 8, 2, 6, shirtDark);

  // --- Cabelo longo (atrás)
  if (c.hair === "long") add(3, 4, 2, 9, shade(hair, -0.15));

  // --- Cabeça
  add(4, 3, 8, 8, skin);
  add(4, 3, 1, 8, skinDark);
  add(9, 7, 1, 1, "#1d1d24");
  add(11, 7, 1, 1, "#1d1d24");
  add(10, 9, 2, 1, shade(skin, -0.3));
  if (fat) {
    add(12, 5, 1, 5, skin); // bochechas
    add(3, 5, 1, 5, skinDark);
    add(11, 9, 1, 1, shade(skin, 0.15));
    add(4, 11, 8, 1, skin); // papada
    add(5, 11, 6, 1, skinDark);
  }

  // --- Cabelo
  if (c.hair !== "bald") {
    {
      add(4, 2, 8, 2, hair);
      add(4, 4, 2, 3, hair);
      if (c.hair === "spiky") {
        add(5, 1, 1, 1, hair);
        add(7, 0, 1, 2, hair);
        add(9, 1, 1, 1, hair);
        add(11, 1, 1, 1, hair);
      }
      if (c.hair === "long") add(4, 4, 1, 6, hair);
    }
  }

  // --- Óculos de sol
  if (c.glasses === "sunglasses") {
    add(8, 6, 5, 2, "#15161c");
    add(10, 6, 1, 1, "#15161c");
    add(9, 6, 1, 1, "#4a6a9a");
    add(12, 6, 1, 1, "#4a6a9a");
    add(5, 6, 3, 1, "#15161c");
  }

  // --- Chapéus premium
  const capColor = c.hatColor ?? "#d24b3e";
  if (c.hat === "cap") {
    add(4, 1, 8, 3, capColor);
    add(11, 3, 4, 1, shade(capColor, -0.25));
    add(6, 1, 3, 1, shade(capColor, 0.25));
  }
  if (c.hat === "crown") {
    add(5, 0, 7, 3, "#f2b84b");
    add(5, -1, 1, 1, "#f2b84b");
    add(8, -1, 1, 1, "#f2b84b");
    add(11, -1, 1, 1, "#f2b84b");
    add(8, 1, 1, 1, "#ef6b5b");
  }

  // --- Pescoço e tronco
  if (!fat) add(7, 11, 3, 1, skinDark);
  if (fat) {
    add(1, 12, 14, 9, shirt);
    add(1, 12, 1, 9, shirtDark);
    add(15, 14, 1, 6, shirt); // barriga para a frente
    add(16, 15, 1, 4, shirt);
    add(10, 15, 4, 4, shade(shirt, 0.12));
    add(2, 20, 14, 1, shirtDark);
  } else {
    add(4, 12, 8, 8, shirt);
    add(4, 12, 1, 8, shirtDark);
  }

  if (c.shirt === "hoodie") {
    add(7, 12, 1, 3, "#f3e9d2");
    add(9, 12, 1, 3, "#f3e9d2");
    add(6, 17, 4, 2, shirtDark);
  }
  if (c.shirt === "tank") {
    add(fat ? 1 : 4, 12, 2, 2, skin);
    add(fat ? 13 : 10, 12, 2, 2, skin);
  }

  // --- Braços (trás e frente) com balanço na caminhada
  const sleeveFull = c.shirt === "hoodie";
  const sleeveLen = sleeveFull ? 7 : c.shirt === "tshirt" ? 3 : 0;
  const arm = (x: number, offset: number, back: boolean) => {
    const base = 12 + offset;
    const sl = back ? shirtDark : shade(shirt, -0.08);
    if (sleeveLen) add(x, base, 2, sleeveLen, sl);
    add(x, base + sleeveLen, 2, 7 - sleeveLen, back ? skinDark : skin);
    add(x, base + 7, 2, 1, back ? skinDark : skin);
  };
  arm(fat ? -1 : 2, -swing, true);
  arm(fat ? 15 : 12, swing, false);

  if (!sitting) {
    // --- Pernas em pé / andando
    const legL = swing; // deslocamento horizontal da passada
    const legR = -swing;
    const lw = fat ? 6 : 4;
    const leg = (x: number, shift: number, dark: boolean) => {
      const col = dark ? pantsDark : pants;
      if (c.pants === "shorts") {
        addAbs(x + shift, 20, lw, 4, col);
        addAbs(x + shift + 1, 24, lw - 2, 3, dark ? skinDark : skin);
      } else {
        addAbs(x + shift, 20, lw, 7, col);
      }
      addAbs(x + shift, 27, lw, 2, shoe);
      addAbs(x + shift + lw - 1, 28, 2, 1, shoe);
    };
    leg(fat ? 2 : 4, legL, true);
    leg(fat ? 8 : 8, legR, false);
  } else {
    // --- Pernas sentadas (coxas na horizontal)
    addAbs(fat ? 1 : 4, 25, fat ? 15 : 10, fat ? 4 : 3, pants);
    addAbs(fat ? 1 : 4, 25, 2, fat ? 4 : 3, pantsDark);
    if (c.pants === "shorts") {
      addAbs(8, 25, 6, 3, pants);
      addAbs(11, 28, 2, 2, skin);
    } else {
      addAbs(11, 28, 3, 2, pants);
    }
    addAbs(11, 30, 5, 2, shoe);
  }

  return (
    <svg
      width={(size * 20) / 34}
      height={size}
      viewBox="-2 -2 20 34"
      className="crisp block"
      style={{ transform: facing === "left" ? "scaleX(-1)" : undefined }}
      aria-hidden
    >
      {px.map(([x, y, w, h, fill], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={fill} />
      ))}
    </svg>
  );
}
