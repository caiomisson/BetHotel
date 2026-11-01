"use client";

import { MessageCircle, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { Initial } from "@/components/ui/Bits";
import { formatBRL } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { ContactInfo } from "@/lib/types";
import { chargeMessage, groupedChargeLink } from "@/lib/whatsapp";
import { useHotel } from "./HotelProvider";

/** Widget "Cobrança Rápida": escolha quem te deve e mande a cobrança pronta no WhatsApp. */
export function QuickCharge({ bare, initialUserId }: { bare?: boolean; initialUserId?: string }) {
  const { me, ledger, guestById } = useHotel();
  const list = ledger.owedToMe;
  const [selected, setSelected] = useState<string | null>(initialUserId ?? list[0]?.userId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (selected && !list.some((l) => l.userId === selected)) setSelected(list[0]?.userId ?? null);
  }, [list, selected]);

  const current = list.find((l) => l.userId === selected);
  const guest = current ? guestById.get(current.userId) : undefined;
  const message = current ? chargeMessage(guest?.full_name ?? guest?.nickname ?? "", current.total, current.titles) : "";

  async function send() {
    if (!current) return;
    setBusy(true);
    setError(null);
    const { data } = await createClient().rpc("get_contact_info", { p_user: current.userId });
    setBusy(false);
    const contact = ((data as ContactInfo[] | null) ?? [])[0];
    if (!contact?.whatsapp) return setError(`@${guest?.nickname} não cadastrou WhatsApp.`);
    window.open(groupedChargeLink(contact.whatsapp, message, me.pix_key), "_blank", "noopener");
  }

  const body = (
    <div className="space-y-3 p-3">
      {list.length === 0 && <p className="py-4 text-center text-sm text-muted">Ninguém te deve nada agora.</p>}
      {list.map((p) => {
        const g = guestById.get(p.userId);
        const on = p.userId === selected;
        return (
          <button
            key={p.userId}
            onClick={() => setSelected(p.userId)}
            className={`flex w-full items-center gap-3 rounded-md border-2 px-3 py-2.5 text-left transition ${
              on ? "border-gold bg-gold/5" : "border-line bg-deep/60 hover:border-line/80"
            }`}
          >
            <Initial guest={g} size={26} />
            <span className="min-w-0 flex-1">
              <span className="block font-pixel text-sm">@{g?.nickname}</span>
              <span className="block truncate text-xs text-muted">{p.titles.join(" · ")}</span>
            </span>
            <span className="font-pixel text-sm text-coral">{formatBRL(p.total)}</span>
          </button>
        );
      })}
      {current && (
        <blockquote className="rounded-md border-l-4 border-gold bg-deep/70 px-3 py-2.5 text-[13px] leading-relaxed text-cream/80">
          &ldquo;{message}&rdquo;
        </blockquote>
      )}
      {error && <p className="text-sm text-coral">{error}</p>}
      <button className="pixel-btn pixel-btn-gold w-full py-3" disabled={!current || busy} onClick={send}>
        <MessageCircle size={16} /> Cobrar no WhatsApp
      </button>
    </div>
  );

  if (bare) return body;
  return (
    <section className="pixel-panel overflow-hidden">
      <h2 className="panel-header">
        <Wallet size={16} className="text-gold" /> Cobrança Rápida
      </h2>
      {body}
    </section>
  );
}
