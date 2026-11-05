"use client";

import {
  ArrowLeft,
  Lock,
  LogOut,
  MessageCircle,
  Plus,
  Receipt,
  Scale,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useHotel } from "@/components/hotel/HotelProvider";
import { IconBox, Initial } from "@/components/ui/Bits";
import { errorMessage, formatBRL } from "@/lib/format";
import {
  EVENT_KIND_LABEL,
  eventBalances,
  suggestTransfers,
} from "@/lib/ledger";
import { createClient } from "@/lib/supabase/client";
import type { ContactInfo } from "@/lib/types";
import { groupedChargeLink } from "@/lib/whatsapp";
import { DebtList } from "./DebtList";
import { EVENT_ICON } from "./EventCard";
import { GuestPicker } from "./GuestPicker";

export function EventPage({ eventId }: { eventId: string }) {
  const { me, events, debts, guests, guestById, nickById } = useHotel();
  const router = useRouter();
  const event = events.find((e) => e.id === eventId);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // formulário de sub-despesa
  const accepted = useMemo(
    () =>
      event?.event_members
        .filter((m) => m.status === "accepted" || m.status === "invited")
        .map((m) => m.user_id) ?? [],
    [event],
  );
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [payer, setPayer] = useState(me.id);
  const [involved, setInvolved] = useState<string[] | null>(null);
  const [invite, setInvite] = useState<string[]>([]);

  if (!event) {
    return (
      <div className="pixel-panel p-6 text-center">
        <p className="mb-3 text-muted">
          Evento não encontrado (ou você saiu dele).
        </p>
        <Link href="/apostas" className="pixel-btn">
          Voltar
        </Link>
      </div>
    );
  }

  const Icon = EVENT_ICON[event.kind];
  const nick = (id: string) => `@${nickById.get(id) ?? "hóspede"}`;
  const open = event.status === "open";
  const myMember = event.event_members.find((m) => m.user_id === me.id);
  const iAmIn =
    myMember?.status === "accepted" || myMember?.status === "invited";
  const iPaidSomething = event.event_expenses.some((x) => x.payer_id === me.id);
  const isCreator = event.creator_id === me.id;
  const canLeave = open && iAmIn && !isCreator;
  const involvedNow = involved ?? accepted;
  const total = event.event_expenses.reduce((s, e) => s + Number(e.amount), 0);
  const balances = eventBalances(event.event_expenses, accepted);
  const transfers = suggestTransfers(balances);
  const eventDebts = debts.filter((d) => d.event_id === event.id);
  const value = Number(amount.replace(/\./g, "").replace(",", "."));
  const shareEach =
    value > 0 && involvedNow.length ? value / involvedNow.length : 0;
  const notMembers = guests.filter(
    (g) =>
      !event.event_members.some(
        (m) =>
          m.user_id === g.id &&
          (m.status === "accepted" || m.status === "invited"),
      ),
  );

  async function run(
    fn: () => PromiseLike<{ error: unknown }>,
    after?: () => void,
  ) {
    setBusy(true);
    setError(null);
    const { error } = await fn();
    setBusy(false);
    if (error) return setError(errorMessage(error));
    after?.();
    router.refresh();
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!value || value <= 0) return setError("Informe um valor válido em R$.");
    if (involvedNow.length === 0)
      return setError("Marque com quem esse gasto será dividido.");
    await run(
      () =>
        createClient().rpc("add_event_expense", {
          p_event: event!.id,
          p_amount: value,
          p_description: desc,
          p_payer: payer,
          p_members: involvedNow,
        }),
      () => {
        setAmount("");
        setDesc("");
        setInvolved(null);
      },
    );
  }

  async function chargeTransfer(debtorId: string, value: number) {
    const { data } = await createClient().rpc("get_contact_info", {
      p_user: debtorId,
    });
    const contact = ((data as ContactInfo[] | null) ?? [])[0];
    if (!contact?.whatsapp)
      return setError(`${nick(debtorId)} não cadastrou WhatsApp.`);
    const msg = `Fala, ${contact.full_name}! No evento "${event!.name}" sua parte comigo deu ${formatBRL(value)}. Bora acertar antes que apareçam teias de aranha no seu quarto?`;
    window.open(
      groupedChargeLink(contact.whatsapp, msg, me.pix_key),
      "_blank",
      "noopener",
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href="/apostas"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-cream"
      >
        <ArrowLeft size={15} /> Apostas &amp; Despesas
      </Link>

      <header className="pixel-panel flex flex-wrap items-center gap-3 p-4">
        <IconBox>
          <Icon size={20} />
        </IconBox>
        <div className="min-w-0 flex-1">
          <h1 className="font-pixel text-xl">{event.name}</h1>
          <p className="text-sm text-muted">
            {EVENT_KIND_LABEL[event.kind]} · criado por{" "}
            {isCreator ? "você" : nick(event.creator_id)} · total{" "}
            {formatBRL(total)}
          </p>
        </div>
        <span
          className={`tag ${open ? "border-mint/70 text-mint" : "border-line text-muted"}`}
        >
          {open ? "Aberto" : "Encerrado"}
        </span>
      </header>

      {canLeave && (
        <div className="pixel-panel flex flex-wrap items-center gap-3 p-3">
          <p className="flex-1 text-sm text-muted">
            {iPaidSomething
              ? "Você pagou um gasto deste evento. Para sair, peça para apagarem esse gasto antes."
              : "Não vai mais participar? Ao sair, a sua parte em cada gasto é dividida entre os outros."}
          </p>
          <button
            className="pixel-btn pixel-btn-coral text-xs"
            disabled={busy || iPaidSomething}
            onClick={() => {
              if (
                !window.confirm(
                  "Sair do evento? Sua parte nos gastos será dividida entre os outros participantes.",
                )
              )
                return;
              run(
                () => createClient().rpc("leave_event", { p_event: event.id }),
                () => router.push("/apostas"),
              );
            }}
          >
            <LogOut size={14} /> Sair do evento
          </button>
        </div>
      )}
      {error && (
        <p className="rounded-md border-2 border-coral/50 px-3 py-2 text-sm text-coral">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {/* Nova sub-despesa */}
          {open && iAmIn && (
            <form onSubmit={addExpense} className="pixel-panel space-y-3 p-4">
              <h2 className="flex items-center gap-2 font-pixel text-base">
                <Plus size={16} className="text-gold" /> Nova despesa
              </h2>
              <div className="grid gap-3 sm:grid-cols-[140px_1fr_180px]">
                <div>
                  <label className="pixel-label" htmlFor="ex-amount">
                    Valor (R$)
                  </label>
                  <input
                    id="ex-amount"
                    inputMode="decimal"
                    className="pixel-input"
                    placeholder="120,00"
                    value={amount}
                    onChange={(e) =>
                      setAmount(e.target.value.replace(/[^\d.,]/g, ""))
                    }
                  />
                </div>
                <div>
                  <label className="pixel-label" htmlFor="ex-desc">
                    Descrição (opcional)
                  </label>
                  <input
                    id="ex-desc"
                    maxLength={200}
                    className="pixel-input"
                    placeholder="Mercado, gasolina…"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                  />
                </div>
                <div>
                  <label className="pixel-label" htmlFor="ex-payer">
                    Quem pagou
                  </label>
                  <select
                    id="ex-payer"
                    className="pixel-input"
                    value={payer}
                    onChange={(e) => setPayer(e.target.value)}
                  >
                    {accepted.map((id) => (
                      <option key={id} value={id}>
                        {id === me.id ? "Você" : nick(id)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <span className="pixel-label">
                  Com quem esse gasto será dividido
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {accepted.map((id) => {
                    const on = involvedNow.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`pixel-btn px-2 py-1 text-xs ${on ? "pixel-btn-gold" : ""}`}
                        onClick={() =>
                          setInvolved(
                            on
                              ? involvedNow.filter((x) => x !== id)
                              : [...involvedNow, id],
                          )
                        }
                      >
                        {id === me.id ? "Você" : nick(id)}
                      </button>
                    );
                  })}
                </div>
                {shareEach > 0 && (
                  <p className="mt-1 text-xs text-muted">
                    Divisão igual: {formatBRL(shareEach)} para cada um.
                  </p>
                )}
              </div>
              <button className="pixel-btn pixel-btn-gold" disabled={busy}>
                Lançar despesa
              </button>
            </form>
          )}

          {/* Lista de despesas */}
          <section className="pixel-panel overflow-hidden">
            <h2 className="panel-header">
              <Receipt size={16} className="text-gold" /> Despesas do evento
            </h2>
            {event.event_expenses.length === 0 && (
              <p className="p-4 text-sm text-muted">
                Nenhuma despesa lançada ainda.
              </p>
            )}
            <ul className="divide-y divide-line/50">
              {[...event.event_expenses]
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .map((ex) => (
                  <li
                    key={ex.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        {ex.description ?? (
                          <span className="text-muted">
                            Despesa sem descrição
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted">
                        {ex.payer_id === me.id ? "Você" : nick(ex.payer_id)}{" "}
                        pagou ·{" "}
                        {new Date(ex.created_at).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <div className="flex -space-x-0.5">
                      {ex.event_expense_splits.map((s) => (
                        <Initial
                          key={s.user_id}
                          guest={guestById.get(s.user_id)}
                          size={20}
                        />
                      ))}
                    </div>
                    <span className="font-pixel text-gold">
                      {formatBRL(ex.amount)}
                    </span>
                    {open && (ex.created_by === me.id || isCreator) && (
                      <button
                        className="text-muted hover:text-coral"
                        aria-label="Apagar despesa"
                        disabled={busy}
                        onClick={() =>
                          confirm("Apagar esta despesa?") &&
                          run(() =>
                            createClient().rpc("delete_event_expense", {
                              p_expense: ex.id,
                            }),
                          )
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          </section>

          {!open && (
            <section className="pixel-panel space-y-3 p-4">
              <h2 className="flex items-center gap-2 font-pixel text-base">
                <Receipt size={16} className="text-gold" /> Cobranças geradas
              </h2>
              {eventDebts.length === 0 ? (
                <p className="text-sm text-muted">
                  Ninguém ficou devendo nada.
                </p>
              ) : (
                <DebtList
                  debts={eventDebts}
                  onChanged={() => router.refresh()}
                />
              )}
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {/* Balanço */}
          <section className="pixel-panel overflow-hidden">
            <h2 className="panel-header">
              <Scale size={16} className="text-gold" /> Balanço
            </h2>
            <ul className="space-y-1 p-3">
              {balances.map((b) => (
                <li key={b.userId} className="flex items-center gap-2 text-sm">
                  <Initial guest={guestById.get(b.userId)} size={22} />
                  <span className="flex-1">
                    {b.userId === me.id ? "Você" : nick(b.userId)}
                  </span>
                  <span className="text-xs text-muted">
                    pagou {formatBRL(b.paid)}
                  </span>
                  <span
                    className={`w-24 text-right font-pixel text-xs ${b.net > 0.004 ? "text-mint" : b.net < -0.004 ? "text-coral" : "text-muted"}`}
                  >
                    {b.net > 0.004 ? "+" : ""}
                    {formatBRL(b.net)}
                  </span>
                </li>
              ))}
            </ul>
            {open && transfers.length > 0 && (
              <div className="space-y-2 border-t-2 border-line p-3">
                <p className="text-[11px] font-semibold uppercase text-muted">
                  Quem paga quem (sugestão)
                </p>
                {transfers.map((t) => (
                  <div
                    key={`${t.from}-${t.to}`}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <span className="flex-1">
                      {t.from === me.id ? "Você" : nick(t.from)} →{" "}
                      {t.to === me.id ? "você" : nick(t.to)}{" "}
                      <b className="font-pixel text-gold">
                        {formatBRL(t.amount)}
                      </b>
                    </span>
                    {t.to === me.id && (
                      <button
                        className="pixel-btn pixel-btn-ghost px-2 py-1 text-xs"
                        onClick={() => chargeTransfer(t.from, t.amount)}
                      >
                        <MessageCircle size={13} /> Cobrar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {open && isCreator && (
              <div className="border-t-2 border-line p-3">
                <button
                  className="pixel-btn pixel-btn-gold w-full"
                  disabled={busy}
                  onClick={() =>
                    confirm(
                      "Encerrar o evento? As cobranças serão geradas e ninguém poderá lançar novas despesas.",
                    ) &&
                    run(() =>
                      createClient().rpc("close_event", { p_event: event.id }),
                    )
                  }
                >
                  <Lock size={15} /> Encerrar e gerar cobranças
                </button>
                <p className="mt-1 text-[11px] text-muted">
                  As cobranças vencem em 48h. Quem fica sem dívidas ganha Hotel
                  Coins pela sua parte.
                </p>
              </div>
            )}
          </section>

          {/* Membros */}
          <section className="pixel-panel overflow-hidden">
            <h2 className="panel-header">
              <Users size={16} className="text-gold" /> Participantes
            </h2>
            <ul className="space-y-1 p-3">
              {event.event_members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-2 text-sm">
                  <Initial guest={guestById.get(m.user_id)} size={22} />
                  <span className="flex-1">
                    {m.user_id === me.id ? "Você" : nick(m.user_id)}
                  </span>
                  <span
                    className={`text-xs ${m.status === "accepted" || m.status === "invited" ? "text-mint" : "text-muted"}`}
                  >
                    {m.status === "accepted" || m.status === "invited"
                      ? "no evento"
                      : m.status === "left"
                        ? "saiu"
                        : "recusou"}
                  </span>
                </li>
              ))}
            </ul>
            {open && iAmIn && (
              <div className="space-y-2 border-t-2 border-line p-3">
                <GuestPicker
                  guests={notMembers}
                  selected={invite}
                  onChange={setInvite}
                  placeholder="Adicionar pessoas @nick"
                />
                <button
                  className="pixel-btn w-full text-xs"
                  disabled={busy || invite.length === 0}
                  onClick={() =>
                    run(
                      () =>
                        createClient().rpc("invite_to_event", {
                          p_event: event.id,
                          p_users: invite,
                        }),
                      () => setInvite([]),
                    )
                  }
                >
                  <UserPlus size={14} /> Adicionar ao evento
                </button>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
