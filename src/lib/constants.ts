import type { AvatarConfig } from "./types";

/** Regras de moedas (espelham confirm_payment no banco). */
export const COINS_PER_REAL = 1;
export const COINS_PER_PRIZE = 10;
export const WEEKLY_COIN_CAP = 500;

/** Uma dívida vence 48h depois de nascer. */
export const DEBT_GRACE_HOURS = 48;

/** Comprovantes: até 4 MB, expiram em 90 dias. */
export const PROOF_MAX_BYTES = 4 * 1024 * 1024;
export const PROOF_TTL_DAYS = 90;
export const PROOF_BUCKET = "proofs";

/** Tamanho da grade por tipo de quarto. */
export const ROOM_SIZES: Record<string, { cols: number; rows: number; label: string }> = {
  kitnet: { cols: 6, rows: 6, label: "Kitnet" },
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
};

/** Estilos premium: só liberados após compra na loja (asset_url do item). */
export const PREMIUM_STYLES = new Set(["jacket", "hoodie", "cap", "crown"]);
