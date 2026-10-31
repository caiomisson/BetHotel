"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { Modal } from "@/components/ui/Modal";
import { PROOF_BUCKET, PROOF_MAX_BYTES, PROOF_TTL_DAYS } from "@/lib/constants";
import { errorMessage, formatBRL } from "@/lib/format";
import { buildPixPayload } from "@/lib/pix";
import { createClient } from "@/lib/supabase/client";
import type { BetExpense, BetParticipant, ContactInfo } from "@/lib/types";

interface PixPaymentModalProps {
  open: boolean;
  onClose: () => void;
  onPaid: () => void;
  bet: BetExpense;
  debt: BetParticipant;
  myId: string;
}

/**
 * "Gateway" Pix visual: monta QR Code e Copia-e-Cola direto para a chave do
 * credor. O pagamento acontece no app do banco; aqui só registramos o aviso.
 */
export function PixPaymentModal({ open, onClose, onPaid, bet, debt, myId }: PixPaymentModalProps) {
  const [creditor, setCreditor] = useState<ContactInfo | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !debt.creditor_id) return;
    setError(null);
    createClient()
      .rpc("get_contact_info", { p_user: debt.creditor_id })
      .then(({ data }) => setCreditor(((data as ContactInfo[] | null) ?? [])[0] ?? null));
  }, [open, debt.creditor_id]);

  const payload = useMemo(() => {
    if (!creditor?.pix_key || !debt.share_amount) return null;
    return buildPixPayload({
      key: creditor.pix_key,
      receiverName: creditor.full_name,
      amount: Number(debt.share_amount),
      description: `BetHotel ${bet.title}`,
      txid: `BH${debt.id.replace(/-/g, "").slice(0, 20)}`,
    });
  }, [creditor, debt, bet.title]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setError(null);
    if (f && f.size > PROOF_MAX_BYTES) {
      setError("A foto passa de 4 MB. Tire um print menor ou comprima a imagem.");
      e.target.value = "";
      return setFile(null);
    }
    setFile(f);
  }

  async function confirmPaid() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    let proofPath: string | null = null;

    if (file) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      proofPath = `${myId}/${debt.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(PROOF_BUCKET).upload(proofPath, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) {
        setSaving(false);
        return setError(`Falha no upload: ${upErr.message}`);
      }
    }

    const { error } = await supabase.rpc("mark_paid", { p_participant: debt.id, p_proof_path: proofPath });
    setSaving(false);
    if (error) return setError(errorMessage(error));
    setFile(null);
    onPaid();
  }

  const isPrize = !debt.share_amount;

  return (
    <Modal open={open} onClose={onClose} title={isPrize ? "🎁 Pagar prenda" : "💸 Pagar via Pix"}>
      <div className="space-y-4">
        <div className="rounded bg-night/50 p-3 text-sm">
          <div className="text-cream/60">{bet.title}</div>
          <div className="text-lg font-semibold text-gold">{isPrize ? bet.prize_text : formatBRL(debt.share_amount)}</div>
          {creditor && (
            <div className="text-cream/80">
              para <b>@{creditor.nickname}</b> ({creditor.full_name})
            </div>
          )}
        </div>

        {!isPrize && creditor && !creditor.pix_key && (
          <p className="text-sm text-coral">@{creditor.nickname} ainda não cadastrou uma chave Pix. Combine o pagamento direto com ele(a).</p>
        )}

        {payload && creditor && (
          <div className="flex flex-col items-center gap-3">
            <div className="rounded bg-white p-3">
              <QRCode value={payload} size={180} />
            </div>
            <div className="w-full">
              <label className="pixel-label">Pix Copia e Cola</label>
              <div className="flex gap-2">
                <input readOnly className="pixel-input font-mono text-xs" value={payload} onFocus={(e) => e.target.select()} />
                <button
                  type="button"
                  className="pixel-btn"
                  onClick={async () => {
                    await navigator.clipboard.writeText(payload);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? "✔" : "Copiar"}
                </button>
              </div>
              <p className="mt-1 text-xs text-cream/60">
                Chave: {creditor.pix_key}. O BetHotel não toca no dinheiro — o Pix vai direto para a conta de quem recebe.
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="pixel-label" htmlFor="proof">
            {isPrize ? "Foto da prenda paga (opcional)" : "Comprovante (opcional)"}
          </label>
          <input id="proof" type="file" accept="image/*" className="pixel-input file:mr-3 file:rounded file:border-0 file:bg-panel2 file:px-2 file:py-1 file:text-cream" onChange={onFile} />
          <p className="mt-1 text-xs text-cream/60">Até 4 MB. A imagem é apagada automaticamente após {PROOF_TTL_DAYS} dias.</p>
        </div>

        {error && <p className="text-sm text-coral">{error}</p>}
        <button className="pixel-btn pixel-btn-mint w-full" onClick={confirmPaid} disabled={saving}>
          {saving ? "Enviando…" : "Já paguei — avisar o credor"}
        </button>
      </div>
    </Modal>
  );
}
