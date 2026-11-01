"use client";

import { ArrowDownLeft, ArrowUpRight, Clock, Plus, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHotel } from "@/components/hotel/HotelProvider";
import { formatBRL } from "@/lib/format";
import { BetCard } from "./BetCard";
import { CreateBetModal } from "./CreateBetModal";

type TypeFilter = "all" | "bet" | "expense";
type StatusFilter = "all" | "pending" | "awaiting_approval" | "settled";

function Tile({ icon, label, value, cls }: { icon: React.ReactNode; label: string; value: string; cls: string }) {
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

export function BetsBoard() {
  const { bets, ledger } = useHotel();
  const router = useRouter();
  const [type, setType] = useState<TypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [creating, setCreating] = useState(false);

  const list = bets.filter((b) => (type === "all" || b.type === type) && (status === "all" || b.status === status));

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <h1 className="font-pixel text-2xl">Apostas &amp; Despesas</h1>
          <p className="text-sm text-muted">Cada conta quitada rende +10 Hotel Coins para reformar o quarto.</p>
        </div>
        <button className="pixel-btn pixel-btn-gold ml-auto px-5 py-3" onClick={() => setCreating(true)}>
          <Plus size={16} /> Novo registro
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={<ArrowDownLeft size={20} />} label="A receber" value={formatBRL(ledger.toReceive)} cls="text-gold" />
        <Tile icon={<ArrowUpRight size={20} />} label="A pagar" value={formatBRL(ledger.toPay)} cls="text-coral" />
        <Tile icon={<Wallet size={20} />} label="Saldo líquido" value={formatBRL(ledger.net)} cls={ledger.net < 0 ? "text-coral" : "text-mint"} />
        <Tile icon={<Clock size={20} />} label="Pendentes" value={String(ledger.pendingCount)} cls="text-cream" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border-2 border-line p-1">
          {(
            [
              ["all", "Tudo"],
              ["bet", "Apostas"],
              ["expense", "Despesas"],
            ] as [TypeFilter, string][]
          ).map(([k, label]) => (
            <button key={k} onClick={() => setType(k)} className={`rounded px-3 py-1.5 font-pixel text-xs ${type === k ? "bg-gold text-night" : "text-muted hover:text-cream"}`}>
              {label}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Status
          <select className="pixel-input w-auto py-2" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            <option value="all">Todos</option>
            <option value="pending">Pendente</option>
            <option value="awaiting_approval">Aguardando confirmação</option>
            <option value="settled">Quitado</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((b) => (
          <BetCard key={b.id} bet={b} onChanged={() => router.refresh()} />
        ))}
      </div>
      {list.length === 0 && <p className="pixel-panel py-10 text-center text-sm text-muted">Nada por aqui. Crie um registro no botão Novo registro.</p>}

      <CreateBetModal open={creating} onClose={() => setCreating(false)} />
    </section>
  );
}
