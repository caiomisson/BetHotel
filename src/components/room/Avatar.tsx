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

  // --- Cabelo
  if (c.hair !== "bald") {
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

  // --- Chapéus premium
  if (c.hat === "cap") {
    add(4, 1, 8, 3, "#d24b3e");
    add(11, 3, 4, 1, shade("#d24b3e", -0.25));
    add(6, 1, 3, 1, shade("#d24b3e", 0.25));
  }
  if (c.hat === "crown") {
    add(5, 0, 7, 3, "#f2b84b");
    add(5, -1, 1, 1, "#f2b84b");
    add(8, -1, 1, 1, "#f2b84b");
    add(11, -1, 1, 1, "#f2b84b");
    add(8, 1, 1, 1, "#ef6b5b");
  }

  // --- Pescoço e tronco
  add(7, 11, 3, 1, skinDark);
  add(4, 12, 8, 8, c.shirt === "tank" ? shirt : shirt);
  add(4, 12, 1, 8, shirtDark);

  if (c.shirt === "jacket") {
    add(7, 12, 2, 8, "#e9e4d8");
    add(8, 12, 1, 8, shirtDark);
    add(5, 12, 2, 1, shade(shirt, 0.25));
    add(9, 12, 2, 1, shade(shirt, 0.25));
  }
  if (c.shirt === "hoodie") {
    add(7, 12, 1, 3, "#f3e9d2");
    add(9, 12, 1, 3, "#f3e9d2");
    add(6, 17, 4, 2, shirtDark);
  }
  if (c.shirt === "tank") {
    add(4, 12, 2, 2, skin);
    add(10, 12, 2, 2, skin);
  }

  // --- Braços (trás e frente) com balanço na caminhada
  const sleeveFull = c.shirt === "jacket" || c.shirt === "hoodie";
  const sleeveLen = sleeveFull ? 7 : c.shirt === "tshirt" ? 3 : 0;
  const arm = (x: number, offset: number, back: boolean) => {
    const base = 12 + offset;
    const sl = back ? shirtDark : shade(shirt, -0.08);
    if (sleeveLen) add(x, base, 2, sleeveLen, sl);
    add(x, base + sleeveLen, 2, 7 - sleeveLen, back ? skinDark : skin);
    add(x, base + 7, 2, 1, back ? skinDark : skin);
  };
  arm(2, -swing, true);
  arm(12, swing, false);

  if (!sitting) {
    // --- Pernas em pé / andando
    const legL = swing; // deslocamento horizontal da passada
    const legR = -swing;
    const leg = (x: number, shift: number, dark: boolean) => {
      const col = dark ? pantsDark : pants;
      if (c.pants === "shorts") {
        addAbs(x + shift, 20, 4, 4, col);
        addAbs(x + shift + 1, 24, 2, 3, dark ? skinDark : skin);
      } else {
        addAbs(x + shift, 20, 4, 7, col);
      }
      addAbs(x + shift, 27, 4, 2, shoe);
      addAbs(x + shift + 3, 28, 2, 1, shoe);
    };
    leg(4, legL, true);
    leg(8, legR, false);
  } else {
    // --- Pernas sentadas (coxas na horizontal)
    addAbs(4, 25, 10, 3, pants);
    addAbs(4, 25, 2, 3, pantsDark);
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
      width={size / 2}
      height={size}
      viewBox="0 -1 16 33"
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
