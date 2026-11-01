"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ChevronDown, FileText, MessageCircle, Plane, Soup, Swords, Trophy, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { useHotel } from "@/components/hotel/HotelProvider";
import { IconBox, Initial } from "@/components/ui/Bits";
import { CATEGORY_LABEL, PROOF_ACCEPT, PROOF_BUCKET, PROOF_MAX_BYTES } from "@/lib/constants";
import { dueLabel, errorMessage, formatBRL, overdueHours } from "@/lib/format";
import { myPosition } from "@/lib/ledger";
import { createClient } from "@/lib/supabase/client";
import type { BetExpense, BetParticipant, ContactInfo } from "@/lib/types";
import { buildChargeLink } from "@/lib/whatsapp";
import { PixPaymentModal } from "./PixPaymentModal";

const CATEGORY_ICON = { aposta: Swords, bolao: Trophy, racha: Soup, viagem: Plane };

const PAID_LABEL: Record<BetParticipant["paid_status"], string> = {
  not_due: "",
  unpaid: "em aberto",
  marked_paid: "avisou que pagou",
  confirmed: "pago",
};

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

export function BetCard({ bet, onChanged }: { bet: BetExpense; onChanged: () => void }) {
  const { me, guestById, nickById } = useHotel();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [winner, setWinner] = useState("");
  const [paying, setPaying] = useState(false);
  const [details, setDetails] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const nick = (id: string | null) => (id ? `@${nickById.get(id) ?? "hóspede"}` : "—");
  const people = bet.bet_participants;
  const players = people.filter((p) => p.role === "participant");
  const myDebt = people.find((p) => p.user_id === me.id && (p.paid_status === "unpaid" || p.paid_status === "marked_paid"));
  const toConfirm = people.filter((p) => p.creditor_id === me.id && p.paid_status === "marked_paid");
  const unpaidToMe = people.filter((p) => p.creditor_id === me.id && p.paid_status === "unpaid");
  const debts = people.filter((p) => p.paid_status !== "not_due");
  const pos = myPosition(bet, me.id);
  const Icon = CATEGORY_ICON[bet.category] ?? Swords;
  const canDeclare = bet.type === "bet" && !bet.winner_id && (bet.witness_id ? bet.witness_id === me.id : bet.creator_id === me.id);
  const canCancel = bet.creator_id === me.id && bet.status !== "settled" && !people.some((p) => p.paid_status === "marked_paid" || p.paid_status === "confirmed");
  const settled = bet.status === "settled";

  async function run(fn: () => PromiseLike<{ error: unknown }>) {
    setBusy(true);
    setError(null);
    const { error } = await fn();
    setBusy(false);
    if (error) setError(errorMessage(error));
    else onChanged();
  }

  /** "Enviar comprovante": sobe o arquivo e já avisa o credor que pagou. */
  async function uploadProof(file: File) {
    if (!myDebt) return;
    if (file.size > PROOF_MAX_BYTES) return setError("O arquivo passa de 4 MB.");
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${me.id}/${myDebt.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(PROOF_BUCKET).upload(path, file, { contentType: file.type });
    if (upErr) {
      setBusy(false);
      return setError(`Falha no upload: ${upErr.message}`);
    }
    const { error } = await supabase.rpc("mark_paid", { p_participant: myDebt.id, p_proof_path: path });
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

  const valueLabel = bet.type === "expense" ? (bet.category === "viagem" ? "Total da viagem" : "Total do racha") : "Valor apostado";

  return (
    <motion.article layout whileHover={{ y: -2 }} className="pixel-panel flex flex-col gap-3 p-4">
      <header className="flex items-start gap-3">
        <IconBox>
          <Icon size={18} />
        </IconBox>
        <div className="min-w-0 flex-1">
          <h3 className="font-pixel text-[15px] leading-tight">{bet.title}</h3>
          <p className="text-xs text-muted">
            {CATEGORY_LABEL[bet.category]} · {shortDate(bet.created_at)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`tag ${settled ? "border-line text-muted" : bet.status === "awaiting_approval" ? "border-sky/70 text-sky" : "border-gold/70 text-gold"}`}>
            {settled ? "Quitado" : bet.status === "awaiting_approval" ? "Aguardando" : "Pendente"}
          </span>
          {pos.result && <span className={`tag ${pos.result === "win" ? "border-gold/70 text-gold" : "border-coral/70 text-coral"}`}>{pos.result === "win" ? "Vitória" : "Derrota"}</span>}
        </div>
      </header>

      {bet.description && <p className="text-sm leading-relaxed text-cream/85">{bet.description}</p>}

      <div className="flex items-end justify-between gap-3 rounded-md border-2 border-line bg-deep/70 px-3 py-2.5">
        <div>
          <div className="text-xs text-muted">{valueLabel}</div>
          <div className="font-pixel text-lg">{bet.amount ? formatBRL(bet.amount) : bet.prize_text}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Sua posição</div>
          <div className={`font-pixel text-sm ${pos.kind === "receive" ? "text-mint" : pos.kind === "pay" ? "text-coral" : "text-muted"}`}>
            {pos.kind === "receive" ? `Recebe ${formatBRL(pos.amount)}` : pos.kind === "pay" ? (pos.amount ? `Deve ${formatBRL(pos.amount)}` : "Deve a prenda") : settled ? "Em dia" : bet.winner_id ? "—" : "Aguardando resultado"}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex -space-x-0.5">
          {people.map((p) => (
            <Initial key={p.id} guest={guestById.get(p.user_id)} size={24} />
          ))}
        </div>
        <button className="flex items-center gap-1 text-xs text-muted hover:text-cream" onClick={() => setDetails((v) => !v)}>
          {people.length} pessoas <ChevronDown size={13} className={details ? "rotate-180" : ""} />
        </button>
      </div>

      {details && (
        <ul className="divide-y divide-line/50 rounded-md border-2 border-line text-sm">
          {bet.witness_id && <li className="px-3 py-1.5 text-xs text-muted">Testemunha: {nick(bet.witness_id)}</li>}
          {bet.type === "bet" && !bet.winner_id && <li className="px-3 py-1.5 text-xs text-muted">{players.map((p) => nick(p.user_id)).join(" vs ")}</li>}
          {debts.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
              <span className="flex-1 text-xs">
                <b>{d.user_id === me.id ? "Você" : nick(d.user_id)}</b> → {d.creditor_id === me.id ? "você" : nick(d.creditor_id)}{" "}
                <span className="text-gold">{d.share_amount ? formatBRL(d.share_amount) : "prenda"}</span>{" "}
                <span suppressHydrationWarning className={d.paid_status === "unpaid" && overdueHours(d.debt_since) > 0 ? "text-coral" : "text-muted"}>
                  · {PAID_LABEL[d.paid_status]}
                  {d.paid_status === "unpaid" && ` · ${dueLabel(d.debt_since)}`}
                </span>
              </span>
              {d.proof_image_url && (d.user_id === me.id || d.creditor_id === me.id) && (
                <button className="text-xs text-sky underline" onClick={() => openProof(d.proof_image_url!)}>
                  comprovante
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Ações */}
      <div className="mt-auto space-y-2">
        {canDeclare && (
          <div className="flex gap-2">
            <select className="pixel-input py-2" value={winner} onChange={(e) => setWinner(e.target.value)} aria-label="Quem venceu?">
              <option value="">Quem venceu?</option>
              {players.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {nick(p.user_id)}
                </option>
              ))}
            </select>
            <button className="pixel-btn pixel-btn-gold shrink-0" disabled={!winner || busy} onClick={() => run(() => createClient().rpc("declare_winner", { p_bet: bet.id, p_winner: winner }))}>
              <Trophy size={14} /> Declarar
            </button>
          </div>
        )}

        {myDebt?.paid_status === "unpaid" && (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button className="pixel-btn pixel-btn-ghost justify-center py-2.5" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload size={15} /> <span className="font-body text-sm">Enviar comprovante</span>
              <span className="text-[10px] text-muted">máx. 4MB</span>
            </button>
            <button className="pixel-btn pixel-btn-gold py-2.5 text-xs" disabled={busy} onClick={() => setPaying(true)}>
              <CheckCircle2 size={15} /> Quitar · +10
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={PROOF_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) uploadProof(f);
              }}
            />
          </div>
        )}
        {myDebt?.paid_status === "marked_paid" && (
          <p className="rounded-md border-2 border-sky/40 bg-sky/10 px-3 py-2 text-xs text-sky">Você avisou que pagou. Esperando {nick(myDebt.creditor_id)} confirmar para liberar +10.</p>
        )}

        {toConfirm.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-md border-2 border-sky/40 bg-sky/5 px-3 py-2">
            <span className="flex-1 text-xs">
              {nick(d.user_id)} diz que pagou {d.share_amount ? formatBRL(d.share_amount) : "a prenda"}
            </span>
            {d.proof_image_url && (
              <button className="pixel-btn px-2 py-1 text-xs" onClick={() => openProof(d.proof_image_url!)}>
                <FileText size={13} /> Ver
              </button>
            )}
            <button className="pixel-btn pixel-btn-mint px-2 py-1 text-xs" disabled={busy} onClick={() => run(() => createClient().rpc("confirm_payment", { p_participant: d.id }))}>
              Confirmar
            </button>
            <button className="pixel-btn pixel-btn-coral px-2 py-1 text-xs" disabled={busy} onClick={() => run(() => createClient().rpc("reject_payment", { p_participant: d.id }))}>
              Não recebi
            </button>
          </div>
        ))}

        {unpaidToMe.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {unpaidToMe.map((d) => (
              <button key={d.id} className="pixel-btn pixel-btn-ghost px-2 py-1 text-xs" onClick={() => charge(d)} title="Cobrança Expressa via WhatsApp">
                <MessageCircle size={13} /> Cobrar {nick(d.user_id)}
              </button>
            ))}
          </div>
        )}

        {canCancel && (
          <button
            className="flex items-center gap-1 text-xs text-muted hover:text-coral"
            disabled={busy}
            onClick={() => confirm("Cancelar este registro?") && run(() => createClient().rpc("cancel_bet_expense", { p_bet: bet.id }))}
          >
            <X size={12} /> Cancelar registro
          </button>
        )}
        {error && <p className="text-sm text-coral">{error}</p>}
      </div>

      {paying && myDebt && (
        <PixPaymentModal
          open
          bet={bet}
          debt={myDebt}
          myId={me.id}
          onClose={() => setPaying(false)}
          onPaid={() => {
            setPaying(false);
            onChanged();
          }}
        />
      )}
    </motion.article>
  );
}
