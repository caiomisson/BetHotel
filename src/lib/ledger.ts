import type { BetExpense, BetParticipant } from "./types";

/** Uma dívida em aberto entre mim e outra pessoa. */
export interface OpenDebt {
  participant: BetParticipant;
  bet: BetExpense;
  /** Quem está do outro lado (devedor, se me devem; credor, se eu devo). */
  otherId: string;
  amount: number;
}

/** Saldo agrupado por pessoa. */
export interface PersonBalance {
  userId: string;
  total: number;
  titles: string[];
  debts: OpenDebt[];
}

export interface Ledger {
  owedToMe: PersonBalance[];
  iOwe: PersonBalance[];
  toReceive: number;
  toPay: number;
  net: number;
  /** Dívidas abertas (minhas ou para mim). */
  pendingCount: number;
  /** Apostas/despesas em que estou e ainda não foram liquidadas. */
  activeBets: number;
  /** Saldo líquido com cada pessoa (+ = ela me deve). */
  netByPerson: Map<string, number>;
}

const OPEN = new Set(["unpaid", "marked_paid"]);

function group(list: OpenDebt[]): PersonBalance[] {
  const map = new Map<string, PersonBalance>();
  for (const d of list) {
    const entry = map.get(d.otherId) ?? { userId: d.otherId, total: 0, titles: [], debts: [] };
    entry.total += d.amount;
    if (!entry.titles.includes(d.bet.title)) entry.titles.push(d.bet.title);
    entry.debts.push(d);
    map.set(d.otherId, entry);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function buildLedger(bets: BetExpense[], myId: string): Ledger {
  const owed: OpenDebt[] = [];
  const owe: OpenDebt[] = [];
  let activeBets = 0;

  for (const bet of bets) {
    const involved = bet.bet_participants.some((p) => p.user_id === myId) || bet.creator_id === myId;
    if (involved && bet.status !== "settled") activeBets++;
    for (const p of bet.bet_participants) {
      if (!OPEN.has(p.paid_status) || !p.creditor_id) continue;
      const amount = Number(p.share_amount ?? 0);
      if (p.creditor_id === myId) owed.push({ participant: p, bet, otherId: p.user_id, amount });
      else if (p.user_id === myId) owe.push({ participant: p, bet, otherId: p.creditor_id, amount });
    }
  }

  const owedToMe = group(owed);
  const iOwe = group(owe);
  const toReceive = owedToMe.reduce((s, x) => s + x.total, 0);
  const toPay = iOwe.reduce((s, x) => s + x.total, 0);

  const netByPerson = new Map<string, number>();
  owedToMe.forEach((p) => netByPerson.set(p.userId, (netByPerson.get(p.userId) ?? 0) + p.total));
  iOwe.forEach((p) => netByPerson.set(p.userId, (netByPerson.get(p.userId) ?? 0) - p.total));

  return {
    owedToMe,
    iOwe,
    toReceive,
    toPay,
    net: toReceive - toPay,
    pendingCount: owed.length + owe.length,
    activeBets,
    netByPerson,
  };
}

/** Minha posição numa aposta/despesa, para o card "Sua posição". */
export function myPosition(bet: BetExpense, myId: string): { kind: "receive" | "pay" | "none"; amount: number; result: "win" | "loss" | null } {
  let receive = 0;
  let pay = 0;
  for (const p of bet.bet_participants) {
    if (p.paid_status === "not_due") continue;
    const amount = Number(p.share_amount ?? 0);
    if (p.creditor_id === myId) receive += amount;
    if (p.user_id === myId) pay += amount;
  }
  const result = bet.type === "bet" && bet.winner_id ? (bet.winner_id === myId ? "win" : bet.bet_participants.some((p) => p.user_id === myId) ? "loss" : null) : null;
  if (receive > 0) return { kind: "receive", amount: receive, result };
  if (pay > 0) return { kind: "pay", amount: pay, result };
  return { kind: "none", amount: 0, result };
}
