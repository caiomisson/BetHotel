"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check, Flame, Martini, Music, PartyPopper, Plane, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useHotel } from "@/components/hotel/HotelProvider";
import { IconBox, Initial } from "@/components/ui/Bits";
import { errorMessage, formatBRL } from "@/lib/format";
import { EVENT_KIND_LABEL, eventBalances } from "@/lib/ledger";
import { createClient } from "@/lib/supabase/client";
import type { EventKind, HotelEvent } from "@/lib/types";

export const EVENT_ICON: Record<EventKind, typeof Plane> = {
  viagem: Plane,
  churrasco: Flame,
  festa: Music,
  reveillon: Martini,
  carnaval: Sparkles,
  outro: PartyPopper,
};

export function EventCard({ event, onChanged }: { event: HotelEvent; onChanged: () => void }) {
  const { me, guestById, debts } = useHotel();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const Icon = EVENT_ICON[event.kind];
  const members = event.event_members.filter((m) => m.status !== "declined");
  const accepted = members.filter((m) => m.status === "accepted");
  const myMember = event.event_members.find((m) => m.user_id === me.id);
  const total = event.event_expenses.reduce((s, e) => s + Number(e.amount), 0);
  const myBalance = eventBalances(event.event_expenses, accepted.map((m) => m.user_id)).find((b) => b.userId === me.id)?.net ?? 0;
  const eventDebts = debts.filter((d) => d.event_id === event.id);
  const openDebts = eventDebts.filter((d) => d.paid_status !== "confirmed");
  const invited = myMember?.status === "invited" && event.status === "open";

  const statusTag = invited
    ? { label: "Convite pendente", cls: "border-sky/70 text-sky" }
    : event.status === "open"
      ? { label: "Aberto", cls: "border-mint/70 text-mint" }
      : openDebts.length
        ? { label: "Pagamento pendente", cls: "border-gold/70 text-gold" }
        : { label: "Quitado", cls: "border-line text-muted" };

  async function respond(accept: boolean) {
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc("respond_event", { p_event: event.id, p_accept: accept });
    setBusy(false);
    if (error) setError(errorMessage(error));
    else onChanged();
  }

  return (
    <motion.article layout whileHover={{ y: -2 }} className="pixel-panel flex flex-col gap-3 p-4">
      <header className="flex items-start gap-3">
        <IconBox>
          <Icon size={18} />
        </IconBox>
        <div className="min-w-0 flex-1">
          <h3 className="font-pixel text-[15px] leading-tight">{event.name}</h3>
          <p className="text-xs text-muted">
            Evento · {EVENT_KIND_LABEL[event.kind]} · {members.length} pessoas
          </p>
        </div>
        <span className={`tag ${statusTag.cls}`}>{statusTag.label}</span>
      </header>

      <div className="flex items-end justify-between gap-3 rounded-md border-2 border-line bg-deep/70 px-3 py-2.5">
        <div>
          <div className="text-xs text-muted">Total gasto</div>
          <div className="font-pixel text-lg">{formatBRL(total)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Seu balanço</div>
          <div className={`font-pixel text-sm ${myBalance > 0.004 ? "text-mint" : myBalance < -0.004 ? "text-coral" : "text-muted"}`}>
            {myBalance > 0.004 ? `Recebe ${formatBRL(myBalance)}` : myBalance < -0.004 ? `Deve ${formatBRL(-myBalance)}` : "Zerado"}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {members.map((m) => (
          <span key={m.user_id} className={m.status === "invited" ? "opacity-40" : ""} title={m.status === "invited" ? "Convite pendente" : undefined}>
            <Initial guest={guestById.get(m.user_id)} size={24} />
          </span>
        ))}
        <span className="ml-auto text-xs text-muted">{event.event_expenses.length} despesas</span>
      </div>

      <div className="mt-auto space-y-2">
        {invited && (
          <div className="grid grid-cols-2 gap-2">
            <button className="pixel-btn pixel-btn-mint" disabled={busy} onClick={() => respond(true)}>
              <Check size={15} /> Aceitar convite
            </button>
            <button className="pixel-btn pixel-btn-coral" disabled={busy} onClick={() => respond(false)}>
              <X size={15} /> Recusar
            </button>
          </div>
        )}
        <Link href={`/apostas/evento/${event.id}`} className="pixel-btn w-full">
          Abrir evento <ArrowRight size={15} />
        </Link>
        {error && <p className="text-sm text-coral">{error}</p>}
      </div>
    </motion.article>
  );
}
