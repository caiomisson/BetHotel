import { formatBRL } from "./format";

/** Normaliza para o formato internacional que o wa.me espera (só dígitos, com DDI). */
export function normalizeWhatsapp(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

interface ChargeInput {
  phone: string;
  debtorNick: string;
  title: string;
  amount: number | null;
  prize: string | null;
  creditorPixKey: string | null;
}

/** Link de Cobrança Expressa com mensagem pré-preenchida. */
export function buildChargeLink({ phone, debtorNick, title, amount, prize, creditorPixKey }: ChargeInput): string {
  const what = amount ? formatBRL(amount) : `a prenda "${prize ?? ""}"`;
  const lines = [
    `Fala @${debtorNick}! 🏨`,
    `Lembrete do BetHotel: tá pendente ${what} de "${title}".`,
    creditorPixKey ? `Minha chave Pix: ${creditorPixKey}` : "",
    `Paga lá e marca no app antes que seu quarto encha de teia 🕷️`,
  ].filter(Boolean);
  return `https://wa.me/${normalizeWhatsapp(phone)}?text=${encodeURIComponent(lines.join("\n"))}`;
}
