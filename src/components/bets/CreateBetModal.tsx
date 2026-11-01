"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useHotel } from "@/components/hotel/HotelProvider";
import { Modal } from "@/components/ui/Modal";
import { errorMessage, formatBRL } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { Plane, Soup, Swords, Trophy } from "lucide-react";
import type { BetCategory, BetType } from "@/lib/types";
import { GuestPicker } from "./GuestPicker";

type ValueMode = "money" | "prize";

const CATEGORIES: { key: BetCategory; type: BetType; label: string; icon: typeof Swords }[] = [
  { key: "aposta", type: "bet", label: "Aposta 1v1", icon: Swords },
  { key: "bolao", type: "bet", label: "Bolão", icon: Trophy },
  { key: "racha", type: "expense", label: "Racha", icon: Soup },
  { key: "viagem", type: "expense", label: "Viagem", icon: Plane },
];

const INITIAL = {
  category: "aposta" as BetCategory,
  type: "bet" as BetType,
  title: "",
  description: "",
  valueMode: "money" as ValueMode,
  amount: "",
  prize: "",
  participants: [] as string[],
  witness: [] as string[],
  includeMe: true,
};

/** Aparelho de Apostas do Bar: aposta 1v1/grupo ou divisão de conta. */
export function CreateBetModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, guests } = useHotel();
  const router = useRouter();
  const [f, setF] = useState(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const others = useMemo(() => guests.filter((g) => g.id !== me.id), [guests, me.id]);
  const amount = Number(f.amount.replace(",", "."));
  const isExpense = f.type === "expense";

  // Divisão igualitária (centavos que sobram ficam com quem pagou)
  const share = useMemo(() => {
    if (!isExpense || !amount || f.participants.length === 0) return 0;
    const people = f.participants.length + (f.includeMe ? 1 : 0);
    return Math.floor((amount / people) * 100) / 100;
  }, [isExpense, amount, f.participants.length, f.includeMe]);

  const update = <K extends keyof typeof INITIAL>(k: K, v: (typeof INITIAL)[K]) => setF((s) => ({ ...s, [k]: v }));

  function close() {
    setF(INITIAL);
    setError(null);
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const money = isExpense || f.valueMode === "money";
    if (money && (!amount || amount <= 0)) return setError("Informe um valor válido em R$.");
    if (!money && !f.prize.trim()) return setError("Descreva a prenda.");
    if (f.participants.length === 0) return setError(isExpense ? "Escolha com quem dividir." : "Escolha pelo menos um oponente.");
    if (f.category === "aposta" && f.participants.length > 1) return setError("Aposta 1v1 é contra uma pessoa só. Para grupo, use Bolão.");
    if (f.witness[0] && f.participants.includes(f.witness[0])) return setError("A testemunha não pode participar.");

    setSaving(true);
    const { error } = await createClient().rpc("create_bet_expense", {
      p_type: f.type,
      p_title: f.title,
      p_description: f.description,
      p_amount: money ? amount : null,
      p_prize_text: money ? null : f.prize,
      p_witness_id: isExpense ? null : f.witness[0] ?? null,
      p_participants: f.participants.map((id) => ({ user_id: id, share_amount: isExpense ? share : null })),
      p_category: f.category,
    });
    setSaving(false);
    if (error) return setError(errorMessage(error));
    close();
    router.push("/apostas");
    router.refresh();
  }

  return (
    <Modal open={open} onClose={close} title="Novo registro">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CATEGORIES.map(({ key, type, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setF((s) => ({ ...s, category: key, type, participants: key === "aposta" ? s.participants.slice(0, 1) : s.participants }))}
              className={`pixel-btn flex-col gap-1 py-2.5 text-xs ${f.category === key ? "pixel-btn-gold" : ""}`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        <div>
          <label className="pixel-label" htmlFor="bet-title">{isExpense ? "O que foi pago?" : "O que está em jogo?"}</label>
          <input
            id="bet-title"
            required
            maxLength={120}
            className="pixel-input"
            placeholder={isExpense ? "Churrasco de sábado" : "Galo x Cruzeiro: quem perde paga"}
            value={f.title}
            onChange={(e) => update("title", e.target.value)}
          />
        </div>

        <div>
          <label className="pixel-label" htmlFor="bet-desc">{isExpense ? "Detalhes (opcional)" : "Termos da aposta"}</label>
          <textarea
            id="bet-desc"
            rows={2}
            maxLength={1000}
            className="pixel-input"
            placeholder={isExpense ? "Carne, carvão e gelo" : "Vale só o tempo normal. Empate ninguém paga."}
            value={f.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </div>

        {!isExpense && (
          <div className="grid grid-cols-2 gap-2">
            {(["money", "prize"] as ValueMode[]).map((m) => (
              <button key={m} type="button" onClick={() => update("valueMode", m)} className={`pixel-btn ${f.valueMode === m ? "pixel-btn-mint" : ""}`}>
                {m === "money" ? "💰 Valor em R$" : "🎁 Prenda"}
              </button>
            ))}
          </div>
        )}

        {isExpense || f.valueMode === "money" ? (
          <div>
            <label className="pixel-label" htmlFor="bet-amount">{isExpense ? "Valor total pago (R$)" : "Valor por participante (R$)"}</label>
            <input
              id="bet-amount"
              inputMode="decimal"
              className="pixel-input"
              placeholder="50,00"
              value={f.amount}
              onChange={(e) => update("amount", e.target.value.replace(/[^\d.,]/g, ""))}
            />
          </div>
        ) : (
          <div>
            <label className="pixel-label" htmlFor="bet-prize">Prenda</label>
            <input
              id="bet-prize"
              maxLength={200}
              className="pixel-input"
              placeholder="Pagar um açaí / usar camisa do rival"
              value={f.prize}
              onChange={(e) => update("prize", e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="pixel-label">{isExpense ? "Dividir com" : f.category === "aposta" ? "Oponente" : "Participantes do bolão"}</label>
          <GuestPicker guests={others} selected={f.participants} onChange={(ids) => update("participants", ids)} single={f.category === "aposta"} />
          {!isExpense && f.participants.length > 1 && (
            <p className="mt-1 text-xs text-cream/60">Bolão: quem vencer leva a parte de cada perdedor.</p>
          )}
        </div>

        {isExpense && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.includeMe} onChange={(e) => update("includeMe", e.target.checked)} />
            Incluir minha parte na divisão
          </label>
        )}

        {isExpense && share > 0 && (
          <p className="rounded bg-night/50 px-3 py-2 text-sm">
            Cada um te deve <b className="text-gold">{formatBRL(share)}</b>
            {f.includeMe && " (você também paga a sua parte)"}.
          </p>
        )}

        {!isExpense && (
          <div>
            <label className="pixel-label">Testemunha (opcional)</label>
            <GuestPicker
              guests={others.filter((g) => !f.participants.includes(g.id))}
              selected={f.witness}
              onChange={(ids) => update("witness", ids)}
              single
              placeholder="Quem vai validar o resultado?"
            />
            <p className="mt-1 text-xs text-cream/60">Com testemunha, só ela declara o vencedor.</p>
          </div>
        )}

        {error && <p className="text-sm text-coral">{error}</p>}
        <button className="pixel-btn pixel-btn-gold w-full" disabled={saving}>
          {saving ? "Registrando…" : isExpense ? "Registrar divisão" : "Apostar!"}
        </button>
      </form>
    </Modal>
  );
}
