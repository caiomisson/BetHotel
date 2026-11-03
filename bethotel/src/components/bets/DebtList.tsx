"use client";

import { CheckCircle2, FileText, MessageCircle, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useHotel } from "@/components/hotel/HotelProvider";
import { Initial } from "@/components/ui/Bits";
import { PROOF_ACCEPT, PROOF_BUCKET, PROOF_MAX_BYTES } from "@/lib/constants";
import { dueLabel, errorMessage, formatBRL, overdueHours } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { ContactInfo, Debt } from "@/lib/types";
import { buildChargeLink } from "@/lib/whatsapp";
import { PixPaymentModal } from "./PixPaymentModal";

const STATUS: Record<Debt["paid_status"], string> = { unpaid: "em aberto", marked_paid: "avisou que pagou", confirmed: "pago" };

/** Cobranças de uma aposta ou evento, com as ações de quem deve e de quem recebe. */
export function DebtList({ debts, onChanged }: { debts: Debt[]; onChanged: () => void }) {
  const { me, guestById, nickById } = useHotel();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<Debt | null>(null);
  const [uploadFor, setUploadFor] = useState<Debt | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nick = (id: string) => `@${nickById.get(id) ?? "hóspede"}`;

  async function run(id: string, fn: () => PromiseLike<{ error: unknown }>) {
    setBusy(id);
    setError(null);
    const { error } = await fn();
    setBusy(null);
    if (error) setError(errorMessage(error));
    else onChanged();
  }

  async function uploadProof(debt: Debt, file: File) {
    if (file.size > PROOF_MAX_BYTES) return setError("O arquivo passa de 4 MB.");
    setBusy(debt.id);
    setError(null);
    const supabase = createClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${me.id}/${debt.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(PROOF_BUCKET).upload(path, file, { contentType: file.type });
    if (upErr) {
      setBusy(null);
      return setError(`Falha no upload: ${upErr.message}`);
    }
    const { error } = await supabase.rpc("mark_paid", { p_debt: debt.id, p_proof_path: path });
    setBusy(null);
    if (error) setError(errorMessage(error));
    else onChanged();
  }

  async function openProof(path: string) {
    const { data, error } = await createClient().storage.from(PROOF_BUCKET).createSignedUrl(path, 300);
    if (error || !data) return setError("Comprovante indisponível (pode ter expirado).");
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function charge(d: Debt) {
    const { data } = await createClient().rpc("get_contact_info", { p_user: d.debtor_id });
    const contact = ((data as ContactInfo[] | null) ?? [])[0];
    if (!contact?.whatsapp) return setError(`${nick(d.debtor_id)} não cadastrou WhatsApp.`);
    window.open(
      buildChargeLink({ phone: contact.whatsapp, debtorNick: contact.nickname, title: d.title, amount: d.amount ? Number(d.amount) : null, prize: null, creditorPixKey: me.pix_key }),
      "_blank",
      "noopener",
    );
  }

  if (debts.length === 0) return null;

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-line/50 rounded-md border-2 border-line">
        {debts.map((d) => {
          const iOwe = d.debtor_id === me.id;
          const mine = d.creditor_id === me.id;
          const late = d.paid_status === "unpaid" && overdueHours(d.debt_since) > 0;
          return (
            <li key={d.id} className="space-y-2 px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <Initial guest={guestById.get(d.debtor_id)} size={20} />
                <span className="min-w-0 flex-1">
                  <b>{iOwe ? "Você" : nick(d.debtor_id)}</b> → {mine ? "você" : nick(d.creditor_id)}{" "}
                  <span className="font-pixel text-gold">{d.amount ? formatBRL(d.amount) : "prenda"}</span>
                  <span suppressHydrationWarning className={`ml-1.5 text-xs ${late ? "text-coral" : d.paid_status === "confirmed" ? "text-mint" : "text-muted"}`}>
                    · {STATUS[d.paid_status]}
                    {d.paid_status === "unpaid" && ` · ${dueLabel(d.debt_since)}`}
                    {d.paid_status === "confirmed" && d.coins_awarded > 0 && ` · +${d.coins_awarded} coins`}
                  </span>
                </span>
              </div>

              {iOwe && d.paid_status === "unpaid" && (
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <button
                    className="pixel-btn pixel-btn-ghost justify-center py-2"
                    disabled={busy === d.id}
                    onClick={() => {
                      setUploadFor(d);
                      fileRef.current?.click();
                    }}
                  >
                    <Upload size={14} /> <span className="font-body text-sm">Enviar comprovante</span>
                    <span className="text-[10px] text-muted">máx. 4MB</span>
                  </button>
                  <button className="pixel-btn pixel-btn-gold py-2 text-xs" disabled={busy === d.id} onClick={() => setPaying(d)}>
                    <CheckCircle2 size={14} /> Quitar · +10
                  </button>
                </div>
              )}
              {iOwe && d.paid_status === "marked_paid" && <p className="text-xs text-sky">Esperando {nick(d.creditor_id)} confirmar para liberar +10.</p>}

              {mine && d.paid_status === "marked_paid" && (
                <div className="flex flex-wrap gap-1.5">
                  {d.proof_image_url && (
                    <button className="pixel-btn px-2 py-1 text-xs" onClick={() => openProof(d.proof_image_url!)}>
                      <FileText size={13} /> Comprovante
                    </button>
                  )}
                  <button className="pixel-btn pixel-btn-mint px-2 py-1 text-xs" disabled={busy === d.id} onClick={() => run(d.id, () => createClient().rpc("confirm_payment", { p_debt: d.id }))}>
                    Confirmar recebimento
                  </button>
                  <button className="pixel-btn pixel-btn-coral px-2 py-1 text-xs" disabled={busy === d.id} onClick={() => run(d.id, () => createClient().rpc("reject_payment", { p_debt: d.id }))}>
                    Não recebi
                  </button>
                </div>
              )}
              {mine && d.paid_status === "unpaid" && (
                <button className="pixel-btn pixel-btn-ghost px-2 py-1 text-xs" onClick={() => charge(d)}>
                  <MessageCircle size={13} /> Cobrar {nick(d.debtor_id)} no WhatsApp
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="text-sm text-coral">{error}</p>}
      <input
        ref={fileRef}
        type="file"
        accept={PROOF_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f && uploadFor) uploadProof(uploadFor, f);
        }}
      />
      {paying && (
        <PixPaymentModal
          open
          debt={paying}
          myId={me.id}
          onClose={() => setPaying(null)}
          onPaid={() => {
            setPaying(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
