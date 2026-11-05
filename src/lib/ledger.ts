import type { Bet, Debt, EventExpense, HotelEvent } from "./types";

/** Saldo agrupado por pessoa (só cobranças em aberto). */
export interface PersonBalance {
  userId: string;
  total: number;
  titles: string[];
  debts: Debt[];
}

export interface Ledger {
  owedToMe: PersonBalance[];
  iOwe: PersonBalance[];
  toReceive: number;
  toPay: number;
  net: number;
  /** Cobranças abertas (minhas ou para mim). */
  pendingCount: number;
  /** Apostas ainda sem resultado + eventos abertos em que estou. */
  activeCount: number;
  /** Convites esperando a minha resposta. */
  invitesCount: number;
  /** Saldo líquido com cada pessoa (+ = ela me deve). */
  netByPerson: Map<string, number>;
}

const OPEN = new Set(["unpaid", "marked_paid"]);

function group(list: { otherId: string; debt: Debt }[]): PersonBalance[] {
  const map = new Map<string, PersonBalance>();
  for (const { otherId, debt } of list) {
    const e = map.get(otherId) ?? { userId: otherId, total: 0, titles: [], debts: [] };
    e.total += Number(debt.amount ?? 0);
    if (!e.titles.includes(debt.title)) e.titles.push(debt.title);
    e.debts.push(debt);
    map.set(otherId, e);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function buildLedger(debts: Debt[], bets: Bet[], events: HotelEvent[], myId: string): Ledger {
  const open = debts.filter((d) => OPEN.has(d.paid_status));
  const owedToMe = group(open.filter((d) => d.creditor_id === myId).map((d) => ({ otherId: d.debtor_id, debt: d })));
  const iOwe = group(open.filter((d) => d.debtor_id === myId).map((d) => ({ otherId: d.creditor_id, debt: d })));
  const toReceive = owedToMe.reduce((s, x) => s + x.total, 0);
  const toPay = iOwe.reduce((s, x) => s + x.total, 0);

  const netByPerson = new Map<string, number>();
  owedToMe.forEach((p) => netByPerson.set(p.userId, (netByPerson.get(p.userId) ?? 0) + p.total));
  iOwe.forEach((p) => netByPerson.set(p.userId, (netByPerson.get(p.userId) ?? 0) - p.total));

  const activeBets = bets.filter((b) => (b.status === "awaiting_acceptance" || b.status === "active") && b.bet_participants.some((p) => p.user_id === myId));
  const openEvents = events.filter((e) => e.status === "open" && e.event_members.some((m) => m.user_id === myId && m.status === "accepted"));
  const invites =
    bets.filter((b) => b.status === "awaiting_acceptance" && b.bet_participants.some((p) => p.user_id === myId && p.invite_status === "pending")).length;

  return {
    owedToMe,
    iOwe,
    toReceive,
    toPay,
    net: toReceive - toPay,
    pendingCount: open.filter((d) => d.creditor_id === myId || d.debtor_id === myId).length,
    activeCount: activeBets.length + openEvents.length,
    invitesCount: invites,
    netByPerson,
  };
}

// ---------------------------------------------------------------------------
// Eventos: balanço e transferências sugeridas (mesmo algoritmo do close_event)
// ---------------------------------------------------------------------------

export interface MemberBalance {
  userId: string;
  paid: number;
  owed: number;
  net: number;
}

export function eventBalances(expenses: EventExpense[], memberIds: string[]): MemberBalance[] {
  const map = new Map<string, MemberBalance>(memberIds.map((id) => [id, { userId: id, paid: 0, owed: 0, net: 0 }]));
  const get = (id: string) => {
    if (!map.has(id)) map.set(id, { userId: id, paid: 0, owed: 0, net: 0 });
    return map.get(id)!;
  };
  for (const e of expenses) {
    get(e.payer_id).paid += Number(e.amount);
    for (const s of e.event_expense_splits) get(s.user_id).owed += Number(s.share_amount);
  }
  for (const b of map.values()) b.net = Math.round((b.paid - b.owed) * 100) / 100;
  return [...map.values()].sort((a, b) => b.net - a.net);
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

/** Mínimo de transferências: maior credor recebe do maior devedor, até zerar. */
export function suggestTransfers(balances: MemberBalance[]): Transfer[] {
  const bal = balances.map((b) => ({ id: b.userId, net: b.net }));
  const out: Transfer[] = [];
  for (let guard = 0; guard < 200; guard++) {
    const c = bal.filter((b) => b.net > 0.004).sort((a, b) => b.net - a.net || a.id.localeCompare(b.id))[0];
    const d = bal.filter((b) => b.net < -0.004).sort((a, b) => a.net - b.net || a.id.localeCompare(b.id))[0];
    if (!c || !d) break;
    const v = Math.round(Math.min(c.net, -d.net) * 100) / 100;
    if (v <= 0) break;
    out.push({ from: d.id, to: c.id, amount: v });
    c.net -= v;
    d.net += v;
  }
  return out;
}

/** Tipo do evento detectado pelo nome — espelha detect_event_kind no banco. */
export function detectEventKind(name: string): HotelEvent["kind"] {
  const s = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (/(reveillon|ano novo|virada)/.test(s)) return "reveillon";
  if (/(carnaval|bloquinho)/.test(s)) return "carnaval";
  if (/(churras|bbq)/.test(s)) return "churrasco";
  if (/(festa|balada|aniver|niver|\brole\b)/.test(s)) return "festa";
  if (/(viagem|trip|ferias|praia|excursao|mochilao)/.test(s)) return "viagem";
  return "outro";
}

export const EVENT_KIND_LABEL: Record<HotelEvent["kind"], string> = {
  viagem: "Viagem",
  churrasco: "Churrasco",
  festa: "Festa",
  reveillon: "Réveillon",
  carnaval: "Carnaval",
  outro: "Evento",
};
