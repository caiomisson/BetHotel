"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHotel } from "@/components/hotel/HotelProvider";
import { formatBRL } from "@/lib/format";
import type { BetExpense } from "@/lib/types";
import { BetCard } from "./BetCard";

type Filter = "open" | "settled" | "all";

export function BetsBoard({ bets }: { bets: BetExpense[] }) {
  const { me } = useHotel();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("open");

  const all = bets.flatMap((b) => b.bet_participants);
  const iOwe = all
    .filter((p) => p.user_id === me.id && (p.paid_status === "unpaid" || p.paid_status === "marked_paid"))
    .reduce((s, p) => s + Number(p.share_amount ?? 0), 0);
  const owedToMe = all
    .filter((p) => p.creditor_id === me.id && (p.paid_status === "unpaid" || p.paid_status === "marked_paid"))
    .reduce((s, p) => s + Number(p.share_amount ?? 0), 0);

  const list = bets.filter((b) => (filter === "all" ? true : filter === "open" ? b.status !== "settled" : b.status === "settled"));

  return (
    <section className="pixel-panel p-4">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="pixel-title">Apostas e contas</h1>
        <div className="ml-auto flex gap-1">
          {(
            [
              ["open", "Em aberto"],
              ["settled", "Liquidadas"],
              ["all", "Todas"],
            ] as [Filter, string][]
          ).map(([k, label]) => (
            <button key={k} className={`pixel-btn ${filter === k ? "pixel-btn-gold" : ""}`} onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded border-2 border-coral/50 bg-coral/10 p-3">
          <div className="text-xs uppercase text-cream/70">Você deve</div>
          <div className="font-pixel text-xs text-coral">{formatBRL(iOwe)}</div>
        </div>
        <div className="rounded border-2 border-mint/50 bg-mint/10 p-3">
          <div className="text-xs uppercase text-cream/70">Te devem</div>
          <div className="font-pixel text-xs text-mint">{formatBRL(owedToMe)}</div>
        </div>
      </div>

      <div className="space-y-3">
        {list.map((b) => (
          <BetCard key={b.id} bet={b} onChanged={() => router.refresh()} />
        ))}
        {list.length === 0 && (
          <p className="py-8 text-center text-sm text-cream/60">Nada por aqui. Abra uma aposta no botão 🎲 lá em cima.</p>
        )}
      </div>
    </section>
  );
}
