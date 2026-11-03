"use client";

import { motion } from "framer-motion";
import { Ban, Check, Clock, Handshake, Swords, Trophy, Users, X } from "lucide-react";
import { useState } from "react";
import { useHotel } from "@/components/hotel/HotelProvider";
import { IconBox, Initial } from "@/components/ui/Bits";
import { errorMessage, formatBRL } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Bet, BetStatus } from "@/lib/types";
import { DebtList } from "./DebtList";

export const BET_STATUS: Record<BetStatus, { label: string; cls: string }> = {
  awaiting_acceptance: { label: "Aguardando aceite", cls: "border-sky/70 text-sky" },
  active: { label: "Ativa", cls: "border-mint/70 text-mint" },
  pending: { label: "Pagamento pendente", cls: "border-gold/70 text-gold" },
  awaiting_approval: { label: "Confirmando pagamento", cls: "border-sky/70 text-sky" },
  settled: { label: "Quitada", cls: "border-line text-muted" },
  draw: { label: "Empate", cls: "border-line text-muted" },
  cancelled: { label: "Cancelada", cls: "border-line text-muted" },
};

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

function deadline(iso: string | null): { text: string; late: boolean } | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  const date = new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).replace(".", "");
  if (ms < 0) return { text: `Prazo encerrado (${date})`, late: true };
  const days = Math.floor(ms / 864e5);
  return { text: days >= 1 ? `Termina em ${days}d · ${date}` : `Termina hoje · ${date}`, late: false };
}

export function BetCard({ bet, onChanged }: { bet: Bet; onChanged: () => void }) {
  const { me, guestById, nickById, debts } = useHotel();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [winners, setWinners] = useState<string[]>([]);
  const [resolving, setResolving] = useState(false);

  const nick = (id: string) => `@${nickById.get(id) ?? "hóspede"}`;
  const people = bet.bet_participants;
  const myRow = people.find((p) => p.user_id === me.id);
  const isCreator = bet.creator_id === me.id;
  const pendingInvites = people.filter((p) => p.invite_status === "pending");
  const accepted = people.length - pendingInvites.length;
  const betDebts = debts.filter((d) => d.bet_id === bet.id);
  const status = BET_STATUS[bet.status];
  const due = bet.status === "active" || bet.status === "awaiting_acceptance" ? deadline(bet.ends_at) : null;
  const cancelVotes = people.filter((p) => p.cancel_vote);
  const amount = Number(bet.amount);

  // Prévia do resultado
  const losers = people.length - winners.length;
  const perWinner = winners.length ? (amount * losers) / winners.length : 0;

  async function run(fn: () => PromiseLike<{ error: unknown }>) {
    setBusy(true);
    setError(null);
    const { error } = await fn();
    setBusy(false);
    if (error) setError(errorMessage(error));
    else {
      setResolving(false);
      setWinners([]);
      onChanged();
    }
  }
  const rpc = (name: string, args: Record<string, unknown>) => () => createClient().rpc(name, args);

  return (
    <motion.article layout whileHover={{ y: -2 }} className="pixel-panel flex flex-col gap-3 p-4">
      <header className="flex items-start gap-3">
        <IconBox>{people.length > 2 ? <Users size={18} /> : <Swords size={18} />}</IconBox>
        <div className="min-w-0 flex-1">
          <h3 className="font-pixel text-[15px] leading-tight">{bet.title}</h3>
          <p className="text-xs text-muted">
            Aposta {people.length > 2 ? "coletiva" : "1v1"} · por {isCreator ? "você" : nick(bet.creator_id)} · {shortDate(bet.created_at)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`tag ${status.cls}`}>{status.label}</span>
          {myRow?.result && <span className={`tag ${myRow.result === "win" ? "border-gold/70 text-gold" : "border-coral/70 text-coral"}`}>{myRow.result === "win" ? "Vitória" : "Derrota"}</span>}
        </div>
      </header>

      <div className="flex items-end justify-between gap-3 rounded-md border-2 border-line bg-deep/70 px-3 py-2.5">
        <div>
          <div className="text-xs text-muted">Valor por pessoa</div>
          <div className="font-pixel text-lg">{formatBRL(amount)}</div>
        </div>
        {due && (
          <div suppressHydrationWarning className={`flex items-center gap-1 text-right text-xs ${due.late ? "text-coral" : "text-muted"}`}>
            <Clock size={13} /> {due.text}
          </div>
        )}
      </div>

      {/* Participantes e aceite */}
      <ul className="space-y-1">
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-2 text-sm">
            <Initial guest={guestById.get(p.user_id)} size={22} />
            <span className="flex-1">{p.user_id === me.id ? "Você" : nick(p.user_id)}</span>
            {bet.status === "awaiting_acceptance" &&
              (p.invite_status === "accepted" ? (
                <span className="flex items-center gap-1 text-xs text-mint">
                  <Check size={12} /> aceitou
                </span>
              ) : (
                <span className="text-xs text-sky">aguardando</span>
              ))}
            {p.result && <span className={`text-xs ${p.result === "win" ? "text-gold" : "text-coral"}`}>{p.result === "win" ? "venceu" : "perdeu"}</span>}
            {bet.status === "active" && p.cancel_vote && <span className="text-xs text-muted">quer cancelar</span>}
          </li>
        ))}
      </ul>
      {bet.status === "awaiting_acceptance" && (
        <p className="text-xs text-muted">
          {accepted} de {people.length} aceitaram. A aposta fica ativa quando todos aceitarem.
        </p>
      )}

      {/* Ações */}
      <div className="mt-auto space-y-2">
        {bet.status === "awaiting_acceptance" && myRow?.invite_status === "pending" && (
          <div className="grid grid-cols-2 gap-2">
            <button className="pixel-btn pixel-btn-mint" disabled={busy} onClick={() => run(rpc("respond_bet", { p_bet: bet.id, p_accept: true }))}>
              <Check size={15} /> Aceitar aposta
            </button>
            <button className="pixel-btn pixel-btn-coral" disabled={busy} onClick={() => run(rpc("respond_bet", { p_bet: bet.id, p_accept: false }))}>
              <X size={15} /> Recusar
            </button>
          </div>
        )}
        {bet.status === "awaiting_acceptance" && isCreator && (
          <button className="flex items-center gap-1 text-xs text-muted hover:text-coral" disabled={busy} onClick={() => confirm("Retirar esta aposta?") && run(rpc("cancel_bet", { p_bet: bet.id, p_agree: true }))}>
            <Ban size={12} /> Retirar aposta
          </button>
        )}

        {bet.status === "active" && isCreator && !resolving && (
          <button className="pixel-btn pixel-btn-gold w-full" onClick={() => setResolving(true)}>
            <Trophy size={15} /> Definir resultado
          </button>
        )}
        {bet.status === "active" && isCreator && resolving && (
          <div className="space-y-2 rounded-md border-2 border-gold/50 bg-gold/5 p-3">
            <p className="text-xs font-semibold uppercase text-muted">Quem venceu?</p>
            <div className="flex flex-wrap gap-1.5">
              {people.map((p) => {
                const on = winners.includes(p.user_id);
                return (
                  <button
                    key={p.user_id}
                    className={`pixel-btn px-2 py-1 text-xs ${on ? "pixel-btn-gold" : ""}`}
                    onClick={() => setWinners((w) => (on ? w.filter((x) => x !== p.user_id) : [...w, p.user_id]))}
                  >
                    {p.user_id === me.id ? "Você" : nick(p.user_id)}
                  </button>
                );
              })}
            </div>
            {winners.length > 0 && winners.length < people.length && (
              <p className="text-xs text-cream/80">
                Cada perdedor paga <b className="text-coral">{formatBRL(amount)}</b>; cada vencedor recebe <b className="text-mint">{formatBRL(perWinner)}</b>.
              </p>
            )}
            {winners.length === people.length && <p className="text-xs text-coral">Todos venceram? Use Declarar empate.</p>}
            <div className="flex flex-wrap gap-2">
              <button className="pixel-btn pixel-btn-gold px-3 py-1.5 text-xs" disabled={busy || winners.length === 0 || winners.length === people.length} onClick={() => run(rpc("declare_result", { p_bet: bet.id, p_winners: winners }))}>
                Confirmar vencedor{winners.length > 1 ? "es" : ""}
              </button>
              <button className="pixel-btn px-3 py-1.5 text-xs" disabled={busy} onClick={() => confirm("Declarar empate? Ninguém paga nada.") && run(rpc("declare_draw", { p_bet: bet.id }))}>
                <Handshake size={13} /> Declarar empate
              </button>
              <button className="text-xs text-muted" onClick={() => setResolving(false)}>
                voltar
              </button>
            </div>
          </div>
        )}
        {bet.status === "active" && !isCreator && <p className="text-xs text-muted">Quando o jogo acabar, {nick(bet.creator_id)} define o resultado.</p>}

        {bet.status === "active" && myRow && (
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted">{cancelVotes.length > 0 ? `${cancelVotes.length} de ${people.length} querem cancelar` : "Cancelar exige que todos concordem."}</span>
            {myRow.cancel_vote ? (
              <button className="text-muted underline" disabled={busy} onClick={() => run(rpc("cancel_bet", { p_bet: bet.id, p_agree: false }))}>
                desistir do cancelamento
              </button>
            ) : (
              <button className="flex items-center gap-1 text-muted hover:text-coral" disabled={busy} onClick={() => run(rpc("cancel_bet", { p_bet: bet.id, p_agree: true }))}>
                <Ban size={12} /> {cancelVotes.length > 0 ? "Concordar em cancelar" : "Propor cancelamento"}
              </button>
            )}
          </div>
        )}

        <DebtList debts={betDebts} onChanged={onChanged} />
        {error && <p className="text-sm text-coral">{error}</p>}
      </div>
    </motion.article>
  );
}
