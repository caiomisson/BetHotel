import type { AvatarConfig } from "./types";

/** Regras de moedas (espelham confirm_payment no banco). */
export const COINS_PER_SETTLEMENT = 10;
export const WEEKLY_COIN_CAP = 100;

/** Uma dívida vence 48h depois de nascer. */
export const DEBT_GRACE_HOURS = 48;

/** Comprovantes: até 4 MB, expiram em 90 dias. */
export const PROOF_MAX_BYTES = 4 * 1024 * 1024;
export const PROOF_ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";
export const PROOF_TTL_DAYS = 90;
export const PROOF_BUCKET = "proofs";

/** Tamanho da grade por tipo de quarto. */
export const ROOM_SIZES: Record<string, { cols: number; rows: number; label: string; price: number }> = {
  kitnet: { cols: 4, rows: 4, label: "Kitnet 4x4", price: 0 },
  studio: { cols: 6, rows: 6, label: "Quarto Studio 6x6", price: 50 },
  loft: { cols: 8, rows: 8, label: "Loft Master 8x8", price: 150 },
};

/**
 * Cidade usada no BR Code do Pix (campo obrigatório do padrão EMV).
 * Não afeta para onde o dinheiro vai — só a chave Pix define o destino.
 */
export const PIX_MERCHANT_CITY = "BRASIL";

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: "#f1c27d",
  hair: "short",
  hairColor: "#3b2a1a",
  shirt: "tshirt",
  shirtColor: "#4a7bd1",
  pants: "jeans",
  pantsColor: "#2f3e66",
  hat: "none",
  hatColor: "#d24b3e",
  glasses: "none",
  body: "normal",
};

/** Estilo de avatar → asset_url do item da loja que o libera. */
export const PREMIUM_STYLE_ASSET: Record<string, string> = {
  hoodie: "hoodie",
  cap: "cap",
  crown: "crown",
  sunglasses: "sunglasses",
};

/** Seções da loja, na ordem em que aparecem. */
export const SHOP_SECTIONS = [
  { key: "reforma", label: "Reforma Inicial", hint: "Upgrades baratos para tirar o quarto do abandono." },
  { key: "basica", label: "Mobílias Básicas", hint: "O essencial para um quarto habitável." },
  { key: "conforto", label: "Conforto & Lazer", hint: "Para receber a galera e assistir o jogo com estilo." },
  { key: "eletronicos", label: "Eletrônicos & Destaques", hint: "As peças que todo mundo repara quando entra no quarto." },
  { key: "vestuario", label: "Aparência do Avatar", hint: "Vista o seu avatar para a ocasião." },
] as const;


/** Paleta da Pintura Simples / Texturizada. */
export const WALL_COLORS = [
  "#e8dcc0", "#f3efe6", "#c9d8c5", "#a9c7dd", "#3f7fb8", "#e7b7a3",
  "#c9795a", "#f2d27a", "#8f9c6b", "#7b5ea8", "#5b6475", "#2f3e66",
];
