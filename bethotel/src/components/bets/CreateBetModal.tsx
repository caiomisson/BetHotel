"use client";

import { CalendarDays, PartyPopper, Swords } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useHotel } from "@/components/hotel/HotelProvider";
import { Modal } from "@/components/ui/Modal";
import { errorMessage, formatBRL } from "@/lib/format";
import { detectEventKind, EVENT_KIND_LABEL } from "@/lib/ledger";
import { createClient } from "@/lib/supabase/client";
import { GuestPicker } from "./GuestPicker";

type Kind = "bet" | "event";

/** Novo Registro: só duas opções — Aposta e Evento. */
export function CreateBetModal({ open, onClose, initial = "bet" }: { open: boolean; onClose: () => void; initial?: Kind }) {
  const { me, guests } = useHotel();
  const router = useRouter();
  const [kind, setKind] = useState<Kind>(initial);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const others = useMemo(() => guests.filter((g) => g.id !== me.id), [guests, me.id]);
  const value = Number(amount.replace(/\./g, "").replace(",", "."));
  const detected = detectEventKind(title);

  function close() {
    setTitle("");
    setAmount("");
    setPeople([]);
    setEndsAt("");
    setError(null);
    onClose();
  }

  function validate(): string | null {
    if (!title.trim()) return kind === "bet" ? "Descreva a aposta." : "O nome do evento é obrigatório.";
    if (kind === "bet" && (!value || value <= 0)) return "Informe um valor válido em R$.";
    if (people.length === 0) return kind === "bet" ? "Escolha pelo menos um participante." : "Convide pelo menos um amigo.";
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validate();
    if (problem) return setError(problem);
    setError(null);
    setSaving(true);
    const supabase = createClient();
    const { data, error } =
      kind === "bet"
        ? await supabase.rpc("create_bet", {
            p_title: title,
            p_amount: value,
            p_participants: people,
            p_ends_at: endsAt ? new Date(endsAt).toISOString() : null,
          })
        : await supabase.rpc("create_event", { p_name: title, p_invitees: people });
    setSaving(false);
    if (error) return setError(errorMessage(error));
    const id = data as string;
    close();
    router.push(kind === "event" ? `/apostas/evento/${id}` : "/apostas");
    router.refresh();
  }

  return (
    <Modal open={open} onClose={close} title="Novo registro">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["bet", "Aposta", "1v1 ou coletiva", Swords],
              ["event", "Evento", "Viagem, churrasco, festa…", PartyPopper],
            ] as const
          ).map(([k, label, hint, Icon]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                setError(null);
              }}
              className={`flex flex-col items-center gap-1 rounded-md border-2 px-3 py-3 transition ${kind === k ? "border-gold bg-gold/10 text-gold" : "border-line text-muted hover:text-cream"}`}
            >
              <Icon size={20} />
              <span className="font-pixel text-sm">{label}</span>
              <span className="text-[11px] text-muted">{hint}</span>
            </button>
          ))}
        </div>

        <div>
          <label className="pixel-label" htmlFor="rec-title">
            {kind === "bet" ? "Descrição da aposta" : "Nome do evento (obrigatório)"}
          </label>
          <input
            id="rec-title"
            required
            maxLength={120}
            className="pixel-input"
            placeholder={kind === "bet" ? "Flamengo x Palmeiras: quem perde paga" : "Viagem pra Ubatuba"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {kind === "event" && title.trim() && (
            <p className="mt-1 text-xs text-muted">
              Tipo detectado: <b className="text-gold">{EVENT_KIND_LABEL[detected]}</b>
              {detected === "outro" ? " (não conta para conquistas de evento)" : " · conta para as conquistas"}
            </p>
          )}
        </div>

        {kind === "bet" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="pixel-label" htmlFor="rec-amount">Valor por pessoa (R$)</label>
              <input id="rec-amount" inputMode="decimal" className="pixel-input" placeholder="20,00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} />
            </div>
            <div>
              <label className="pixel-label" htmlFor="rec-end">
                <CalendarDays size={11} className="mr-1 inline" />
                Término (opcional)
              </label>
              <input id="rec-end" type="datetime-local" className="pixel-input" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
        )}

        <div>
          <label className="pixel-label">{kind === "bet" ? "Participantes" : "Convidar amigos"}</label>
          <GuestPicker guests={others} selected={people} onChange={setPeople} placeholder="Buscar @nick" />
          <p className="mt-1 text-xs text-muted">
            {kind === "bet"
              ? people.length > 1
                ? `Aposta coletiva com ${people.length + 1} pessoas. Fica ativa quando todos aceitarem.`
                : "1 oponente = 1v1. Vários = coletiva. Fica ativa quando todos aceitarem."
              : "Os convidados precisam aceitar o convite para entrar nas contas."}
          </p>
          {kind === "bet" && value > 0 && people.length > 0 && (
            <p className="mt-1 text-xs text-cream/80">Cada perdedor paga {formatBRL(value)}; o total é dividido entre os vencedores.</p>
          )}
        </div>

        {error && <p className="text-sm text-coral">{error}</p>}
        <button className="pixel-btn pixel-btn-gold w-full" disabled={saving}>
          {saving ? "Criando…" : kind === "bet" ? "Enviar convites da aposta" : "Criar evento e convidar"}
        </button>
      </form>
    </Modal>
  );
}
