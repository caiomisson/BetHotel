"use client";

import { useState } from "react";
import { useHotel } from "@/components/hotel/HotelProvider";
import { PROOF_BUCKET } from "@/lib/constants";
import { dueLabel, errorMessage, formatBRL, formatDate, overdueHours } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { BetExpense, BetParticipant, ContactInfo } from "@/lib/types";
import { buildChargeLink } from "@/lib/whatsapp";
import { PixPaymentModal } from "./PixPaymentModal";

const STATUS_LABEL: Record<BetExpense["status"], { text: string; cls: string }> = {
  pending: { text: "Pendente", cls: "bg-gold text-night" },
  awaiting_approval: { text: "Aguardando confirmação", cls: "bg-sky text-night" },
  settled: { text: "Liquidada", cls: "bg-mint text-night" },
};

const PAID_LABEL: Record<BetParticipant["paid_status"], string> = {
  not_due: "",
  unpaid: "em aberto",
  marked_paid: "avisou que pagou",
  confirmed: "pago ✔",
};

export function BetCard({ bet, onChanged }: { bet: BetExpense; onChanged: () => void }) {
  const { me, nickById } = useHotel();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [winner, setWinner] = useState("");
  const [payingDebt, setPayingDebt] = useState<BetParticipant | null>(null);

  const nick = (id: string | null) => (id ? `@${nickById.get(id) ?? "hóspede"}` : "—");
  const players = bet.bet_participants.filter((p) => p.role === "participant");
  const debts = bet.bet_participants.filter((p) => p.paid_status !== "not_due");
  const canDeclare =
    bet.type === "bet" &&
    !bet.winner_id &&
    (bet.witness_id ? bet.witness_id === me.id : bet.creator_id === me.id);
  const canCancel =
    bet.creator_id === me.id && !bet.bet_participants.some((p) => p.paid_status === "marked_paid" || p.paid_status === "confirmed");

  async function run(fn: () => PromiseLike<{ error: unknown }>) {
    setBusy(true);
    setError(null);
    const { error } = await fn();
    setBusy(false);
    if (error) setError(errorMessage(error));
    else onChanged();
  }

  async function openProof(path: string) {
    const { data, error } = await createClient().storage.from(PROOF_BUCKET).createSignedUrl(path, 300);
    if (error || !data) return setError("Comprovante indisponível (pode ter expirado).");
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function charge(debt: BetParticipant) {
    const { data } = await createClient().rpc("get_contact_info", { p_user: debt.user_id });
    const contact = ((data as ContactInfo[] | null) ?? [])[0];
    if (!contact?.whatsapp) return setError(`${nick(debt.user_id)} não cadastrou WhatsApp.`);
    window.open(
      buildChargeLink({
        phone: contact.whatsapp,
        debtorNick: contact.nickname,
        title: bet.title,
        amount: debt.share_amount ? Number(debt.share_amount) : null,
        prize: bet.prize_text,
        creditorPixKey: me.pix_key,
      }),
      "_blank",
      "noopener",
    );
  }

  const status = STATUS_LABEL[bet.status];

  return (
    <article className="rounded border-2 border-line bg-night/40 p-4">
      <header className="flex flex-wrap items-start gap-2">
        <span className="text-xl" aria-hidden>
          {bet.type === "bet" ? "🎲" : "🧾"}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{bet.title}</h3>
          <p className="text-xs text-cream/60">
            {bet.type === "bet" ? "Aposta" : "Conta dividida"} por {nick(bet.creator_id)} · {formatDate(bet.created_at)}
            {bet.witness_id && <> · testemunha {nick(bet.witness_id)}</>}
          </p>
        </div>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${status.cls}`}>{status.text}</span>
      </header>

      {bet.description && <p className="mt-2 text-sm text-cream/80">{bet.description}</p>}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span>
          {bet.amount ? (
            <>
              💰 <b className="text-gold">{formatBRL(bet.amount)}</b> {bet.type === "bet" ? "por cabeça" : "no total"}
            </>
          ) : (
            <>
              🎁 <b className="text-gold">{bet.prize_text}</b>
            </>
          )}
        </span>
        {bet.type === "bet" && <span>👥 {players.map((p) => nick(p.user_id)).join(" vs ")}</span>}
        {bet.winner_id && <span>🏆 {nick(bet.winner_id)}</span>}
      </div>

      {canDeclare && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select className="pixel-input max-w-[200px]" value={winner} onChange={(e) => setWinner(e.target.value)}>
            <option value="">Quem venceu?</option>
            {players.map((p) => (
              <option key={p.user_id} value={p.user_id}>
                {nick(p.user_id)}
              </option>
            ))}
          </select>
          <button
            className="pixel-btn pixel-btn-gold"
            disabled={!winner || busy}
            onClick={() => run(() => createClient().rpc("declare_winner", { p_bet: bet.id, p_winner: winner }))}
          >
            Declarar vencedor
          </button>
        </div>
      )}

      {debts.length > 0 && (
        <ul className="mt-3 divide-y divide-line/40 rounded border border-line/60">
          {debts.map((d) => {
            const iOwe = d.user_id === me.id;
            const owedToMe = d.creditor_id === me.id;
            const late = d.paid_status === "unpaid" && overdueHours(d.debt_since) > 0;
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <span className="flex-1">
                  <b>{iOwe ? "Você" : nick(d.user_id)}</b> → {owedToMe ? "você" : nick(d.creditor_id)}{" "}
                  <span className="text-gold">{d.share_amount ? formatBRL(d.share_amount) : "prenda"}</span>
                  <span suppressHydrationWarning className={`ml-2 text-xs ${late ? "text-coral" : "text-cream/60"}`}>
                    {PAID_LABEL[d.paid_status]}
                    {d.paid_status === "unpaid" && ` · ${dueLabel(d.debt_since)}`}
                    {d.paid_status === "confirmed" && d.coins_awarded > 0 && ` · +${d.coins_awarded} moedas`}
                  </span>
                </span>

                {iOwe && d.paid_status === "unpaid" && (
                  <button className="pixel-btn pixel-btn-mint" onClick={() => setPayingDebt(d)}>
                    Pagar
                  </button>
                )}
                {owedToMe && d.paid_status === "unpaid" && (
                  <button className="pixel-btn" onClick={() => charge(d)} title="Cobrança Expressa via WhatsApp">
                    📲 Cobrar
                  </button>
                )}
                {d.proof_image_url && (owedToMe || iOwe) && (
                  <button className="pixel-btn" onClick={() => openProof(d.proof_image_url!)}>
                    🧾 Comprovante
                  </button>
                )}
                {owedToMe && d.paid_status === "marked_paid" && (
                  <>
                    <button
                      className="pixel-btn pixel-btn-mint"
                      disabled={busy}
                      onClick={() => run(() => createClient().rpc("confirm_payment", { p_participant: d.id }))}
                    >
                      Confirmar recebimento
                    </button>
                    <button
                      className="pixel-btn pixel-btn-coral"
                      disabled={busy}
                      onClick={() => run(() => createClient().rpc("reject_payment", { p_participant: d.id }))}
                    >
                      Não recebi
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canCancel && bet.status !== "settled" && (
        <button
          className="mt-3 text-xs text-cream/50 underline hover:text-coral"
          disabled={busy}
          onClick={() => confirm("Cancelar esta aposta/conta?") && run(() => createClient().rpc("cancel_bet_expense", { p_bet: bet.id }))}
        >
          Cancelar
        </button>
      )}

      {error && <p className="mt-2 text-sm text-coral">{error}</p>}

      {payingDebt && (
        <PixPaymentModal
          open
          bet={bet}
          debt={payingDebt}
          myId={me.id}
          onClose={() => setPayingDebt(null)}
          onPaid={() => {
            setPayingDebt(null);
            onChanged();
          }}
        />
      )}
    </article>
  );
}
