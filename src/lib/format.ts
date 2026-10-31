import { DEBT_GRACE_HOURS } from "./constants";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return brl.format(Number(value));
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** Horas de atraso além do prazo de 48h (0 se ainda no prazo). */
export function overdueHours(debtSince: string | null): number {
  if (!debtSince) return 0;
  const hours = (Date.now() - new Date(debtSince).getTime()) / 36e5 - DEBT_GRACE_HOURS;
  return Math.max(0, hours);
}

/** Texto humano para o prazo restante ou atraso. */
export function dueLabel(debtSince: string | null): string {
  if (!debtSince) return "";
  const elapsed = (Date.now() - new Date(debtSince).getTime()) / 36e5;
  const left = DEBT_GRACE_HOURS - elapsed;
  if (left > 0) return `vence em ${Math.ceil(left)}h`;
  const late = Math.ceil(-left);
  return late >= 24 ? `${Math.floor(late / 24)}d de atraso` : `${late}h de atraso`;
}

/** Converte mensagens de erro do Postgres em algo legível. */
export function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const msg = String((err as { message: string }).message);
    if (msg.includes("profiles_nickname_key")) return "Esse @nick já está em uso.";
    if (msg.includes("profiles_whatsapp_check")) return "WhatsApp inválido. Use DDD + número.";
    return msg;
  }
  return "Algo deu errado. Tente de novo.";
}
