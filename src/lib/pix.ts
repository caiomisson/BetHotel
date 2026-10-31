import { PIX_MERCHANT_CITY } from "./constants";

/**
 * Gera um BR Code Pix estático (padrão EMV do Banco Central) apontando direto
 * para a chave do credor. O BetHotel não intermedia nem custodia dinheiro:
 * o QR Code apenas preenche o app do banco do devedor.
 */

function tlv(id: string, value: string): string {
  return id + value.length.toString().padStart(2, "0") + value;
}

/** Remove acentos/caracteres fora do ASCII exigido pelo padrão. */
function sanitize(text: string, max: number): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .\-@]/g, "")
    .trim()
    .toUpperCase()
    .slice(0, max);
}

/** CRC16-CCITT (poly 0x1021, init 0xFFFF) exigido no campo 63. */
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface PixPayloadInput {
  key: string;
  receiverName: string;
  amount?: number | null;
  description?: string;
  txid?: string;
}

export function buildPixPayload({ key, receiverName, amount, description, txid }: PixPayloadInput): string {
  const desc = description ? sanitize(description, 40) : "";
  const merchantAccount =
    tlv("00", "br.gov.bcb.pix") + tlv("01", key.trim()) + (desc ? tlv("02", desc) : "");

  const payload =
    tlv("00", "01") +
    tlv("26", merchantAccount) +
    tlv("52", "0000") +
    tlv("53", "986") +
    (amount && amount > 0 ? tlv("54", amount.toFixed(2)) : "") +
    tlv("58", "BR") +
    tlv("59", sanitize(receiverName, 25) || "RECEBEDOR") +
    tlv("60", sanitize(PIX_MERCHANT_CITY, 15)) +
    tlv("62", tlv("05", (txid ?? "BETHOTEL").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***")) +
    "6304";

  return payload + crc16(payload);
}
