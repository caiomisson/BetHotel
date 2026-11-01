"use client";

import { ArrowDownLeft, ArrowUpRight, MessageCircle, Plus, Swords, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CreateBetModal } from "@/components/bets/CreateBetModal";
import { useHotel } from "@/components/hotel/HotelProvider";
import { QuickCharge } from "@/components/hotel/QuickCharge";
import { cleanlinessBadge } from "@/components/ui/Bits";
import { Modal } from "@/components/ui/Modal";
import { formatBRL } from "@/lib/format";
import type { PersonBalance } from "@/lib/ledger";
import type { PublicProfile } from "@/lib/types";

function Totals({ receive, pay }: { receive: number; pay: number }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-md border-2 border-mint/40 bg-mint/10 p-2.5">
        <div className="flex items-center gap-1 text-[11px] font-semibold uppercase text-mint">
          <ArrowDownLeft size={12} /> A receber
        </div>
        <div className="font-pixel text-xl text-mint">{formatBRL(receive)}</div>
      </div>
      <div className="rounded-md border-2 border-coral/40 bg-coral/10 p-2.5">
        <div className="flex items-center gap-1 text-[11px] font-semibold uppercase text-coral">
          <ArrowUpRight size={12} /> A pagar
        </div>
        <div className="font-pixel text-xl text-coral">{formatBRL(pay)}</div>
      </div>
    </div>
  );
}

function PersonList({ title, list, sign }: { title: string; list: PersonBalance[]; sign: "+" | "-" }) {
  const { guestById } = useHotel();
  return (
    <div>
      <h3 className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {list.length === 0 && <p className="py-1 text-xs text-muted">Nada por aqui.</p>}
      <ul className="space-y-0.5">
        {list.map((p) => {
          const g = guestById.get(p.userId);
          return (
            <li key={p.userId} className="flex items-center gap-2.5 rounded px-1 py-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g?.avatar_config.shirtColor ?? "#64748b" }} />
              <span className="min-w-0 flex-1">
                <span className="block font-pixel text-[13px]">@{g?.nickname}</span>
                <span className="block truncate text-xs text-muted">{p.titles.join(" · ")}</span>
              </span>
              <span className={`font-pixel text-[13px] ${sign === "+" ? "text-mint" : "text-coral"}`}>
                {sign}
                {formatBRL(p.total)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Resumo financeiro do apostador (lado direito do Meu Quarto). */
export function AccountsPanel() {
  const { ledger } = useHotel();
  const [betOpen, setBetOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);

  return (
    <>
      <section className="pixel-panel overflow-hidden">
        <h2 className="panel-header justify-between">
          <span className="flex items-center gap-2">
            <Wallet size={16} className="text-gold" /> Minhas Contas
          </span>
          <Link href="/apostas" className="font-body text-xs text-muted hover:text-cream">
            Ver tudo
          </Link>
        </h2>
        <div className="p-3">
          <Totals receive={ledger.toReceive} pay={ledger.toPay} />
          <div className="mt-2 flex items-center justify-between rounded-md border-2 border-line bg-deep/60 px-3 py-2.5 text-sm">
            <span className="flex items-center gap-2">
              <Swords size={15} className="text-gold" /> Apostas ativas
            </span>
            <span className="font-pixel text-gold">{ledger.activeBets}</span>
          </div>
          <PersonList title="Te devem" list={ledger.owedToMe} sign="+" />
          <PersonList title="Você deve" list={ledger.iOwe} sign="-" />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <button className="pixel-btn pixel-btn-gold py-3 text-xs" onClick={() => setBetOpen(true)}>
          <Plus size={15} /> Criar Nova Aposta
        </button>
        <button className="pixel-btn pixel-btn-mint py-3 text-xs" onClick={() => setChargeOpen(true)}>
          <MessageCircle size={15} /> Cobrar no WhatsApp
        </button>
      </div>

      <CreateBetModal open={betOpen} onClose={() => setBetOpen(false)} />
      <Modal open={chargeOpen} onClose={() => setChargeOpen(false)} title="Cobrança Rápida">
        <div className="-m-4">
          <QuickCharge bare />
        </div>
      </Modal>
    </>
  );
}

/** Painel lateral ao visitar o quarto de um amigo. */
export function VisitPanel({ owner, cleanliness, wins }: { owner: PublicProfile; cleanliness: number; wins: number }) {
  const { ledger } = useHotel();
  const [chargeOpen, setChargeOpen] = useState(false);
  const owesMe = ledger.owedToMe.find((p) => p.userId === owner.id);
  const iOwe = ledger.iOwe.find((p) => p.userId === owner.id);
  const badge = cleanlinessBadge(cleanliness);

  return (
    <>
      <section className="pixel-panel overflow-hidden">
        <h2 className="panel-header">
          <Wallet size={16} className="text-gold" /> Contas com @{owner.nickname}
        </h2>
        <div className="space-y-3 p-3">
          <Totals receive={owesMe?.total ?? 0} pay={iOwe?.total ?? 0} />
          <div className="flex flex-wrap gap-1.5">
            <span className={`tag ${badge.cls}`}>
              {badge.label} · {cleanliness}%
            </span>
            <span className="tag border-gold/60 text-gold">
              {wins} vitória{wins === 1 ? "" : "s"}
            </span>
          </div>
          {owner.bio && <p className="text-sm italic text-cream/70">&ldquo;{owner.bio}&rdquo;</p>}
          {owesMe && <p className="text-xs text-muted">Pendências: {owesMe.titles.join(" · ")}</p>}
          {iOwe && <p className="text-xs text-muted">Você deve: {iOwe.titles.join(" · ")}</p>}
        </div>
      </section>
      {owesMe && (
        <button className="pixel-btn pixel-btn-mint py-3" onClick={() => setChargeOpen(true)}>
          <MessageCircle size={15} /> Cobrar @{owner.nickname} no WhatsApp
        </button>
      )}
      <Link href="/" className="pixel-btn">
        Voltar para o meu quarto
      </Link>
      <Modal open={chargeOpen} onClose={() => setChargeOpen(false)} title="Cobrança Rápida">
        <div className="-m-4">
          <QuickCharge bare initialUserId={owner.id} />
        </div>
      </Modal>
    </>
  );
}
