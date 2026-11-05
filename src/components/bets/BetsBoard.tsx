"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  BellRing,
  Clock,
  Plus,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHotel } from "@/components/hotel/HotelProvider";
import { formatBRL } from "@/lib/format";
import type { Bet, Debt, HotelEvent } from "@/lib/types";
import { BetCard } from "./BetCard";
import { CreateBetModal } from "./CreateBetModal";
import { EventCard } from "./EventCard";

type TypeFilter = "all" | "bet" | "event";
type Phase = "invite" | "running" | "paying" | "done";
type StatusFilter = "all" | Phase;

const PHASE_LABEL: Record<StatusFilter, string> = {
  all: "Todos",
  invite: "Aguardando aceite",
  running: "Em andamento",
  paying: "Pagamento pendente",
  done: "Encerrados",
};

function Tile({
  icon,
  label,
  value,
  cls,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  cls: string;
}) {
  return (
    <div className="pixel-panel flex items-center gap-4 px-4 py-3.5">
      <span className={cls}>{icon}</span>
      <div>
        <div className="text-sm text-muted">{label}</div>
        <div className={`font-pixel text-xl ${cls}`}>{value}</div>
      </div>
    </div>
  );
}

function betPhase(b: Bet): Phase {
  if (b.status === "awaiting_acceptance") return "invite";
  if (b.status === "active") return "running";
  if (b.status === "pending" || b.status === "awaiting_approval")
    return "paying";
  return "done";
}

function eventPhase(e: HotelEvent, myId: string, debts: Debt[]): Phase {
  if (e.status === "open") return "running";
  return debts.some((d) => d.event_id === e.id && d.paid_status !== "confirmed")
    ? "paying"
    : "done";
}

type Row =
  | { kind: "bet"; bet: Bet; phase: Phase; at: string }
  | { kind: "event"; event: HotelEvent; phase: Phase; at: string };

export function BetsBoard() {
  const { me, bets, events, debts, ledger } = useHotel();
  const router = useRouter();
  const [type, setType] = useState<TypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [creating, setCreating] = useState(false);

  const rows: Row[] = [
    ...bets.map((b) => ({
      kind: "bet" as const,
      bet: b,
      phase: betPhase(b),
      at: b.created_at,
    })),
    ...events.map((e) => ({
      kind: "event" as const,
      event: e,
      phase: eventPhase(e, me.id, debts),
      at: e.created_at,
    })),
  ]
    .filter(
      (r) =>
        (type === "all" || r.kind === type) &&
        (status === "all" || r.phase === status),
    )
    .sort(
      (a, b) =>
        Number(a.phase === "done") - Number(b.phase === "done") ||
        b.at.localeCompare(a.at),
    );

  const refresh = () => router.refresh();

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <h1 className="font-pixel text-2xl">Apostas &amp; Despesas</h1>
          <p className="text-sm text-muted">
            Quem ganha a aposta recebe Hotel Coins ao confirmar o pagamento; em
            eventos, cada um ganha pela sua parte quando o evento fica quitado.
          </p>
        </div>
        <button
          className="pixel-btn pixel-btn-gold ml-auto px-5 py-3"
          onClick={() => setCreating(true)}
        >
          <Plus size={16} /> Novo registro
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          icon={<ArrowDownLeft size={20} />}
          label="A receber"
          value={formatBRL(ledger.toReceive)}
          cls="text-gold"
        />
        <Tile
          icon={<ArrowUpRight size={20} />}
          label="A pagar"
          value={formatBRL(ledger.toPay)}
          cls="text-coral"
        />
        <Tile
          icon={<Wallet size={20} />}
          label="Saldo líquido"
          value={formatBRL(ledger.net)}
          cls={ledger.net < 0 ? "text-coral" : "text-mint"}
        />
        <Tile
          icon={<Clock size={20} />}
          label="Pendentes"
          value={String(ledger.pendingCount)}
          cls="text-cream"
        />
      </div>

      {ledger.invitesCount > 0 && (
        <button
          onClick={() => setStatus("invite")}
          className="mb-4 flex w-full items-center gap-2 rounded-md border-2 border-sky/60 bg-sky/10 px-4 py-2.5 text-left text-sm text-sky"
        >
          <BellRing size={16} />
          Você tem {ledger.invitesCount} convite
          {ledger.invitesCount > 1 ? "s" : ""} esperando resposta. Ver agora
        </button>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border-2 border-line p-1">
          {(
            [
              ["all", "Tudo"],
              ["bet", "Apostas"],
              ["event", "Eventos"],
            ] as [TypeFilter, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setType(k)}
              className={`rounded px-3 py-1.5 font-pixel text-xs ${type === k ? "bg-gold text-night" : "text-muted hover:text-cream"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Status
          <select
            className="pixel-input w-auto py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
          >
            {(Object.keys(PHASE_LABEL) as StatusFilter[]).map((k) => (
              <option key={k} value={k}>
                {PHASE_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) =>
          r.kind === "bet" ? (
            <BetCard key={r.bet.id} bet={r.bet} onChanged={refresh} />
          ) : (
            <EventCard key={r.event.id} event={r.event} onChanged={refresh} />
          ),
        )}
      </div>
      {rows.length === 0 && (
        <p className="pixel-panel py-10 text-center text-sm text-muted">
          Nada por aqui. Crie uma aposta ou um evento em Novo registro.
        </p>
      )}

      <CreateBetModal open={creating} onClose={() => setCreating(false)} />
    </section>
  );
}
