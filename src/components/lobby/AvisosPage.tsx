"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bug, Coins, Hammer, Medal, Megaphone, MessagesSquare, PartyPopper, Radio, SendHorizontal, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useHotel } from "@/components/hotel/HotelProvider";
import { PRESENCE_DOT, usePresence, useOnlineCount } from "@/components/hotel/PresenceProvider";
import { QuickCharge } from "@/components/hotel/QuickCharge";
import { IconBox, Initial } from "@/components/ui/Bits";
import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/format";
import type { ChatMessage, LobbyEvent } from "@/lib/types";
import { MentionInput } from "./MentionInput";

/** Tira o emoji inicial das mensagens automáticas (o card já mostra um ícone). */
const stripEmoji = (t: string) => t.replace(/^[^\p{L}\p{N}@]+/u, "");

function eventIcon(kind: string) {
  if (kind === "ranking" || kind === "winner") return { icon: <Trophy size={17} />, tone: "gold" as const };
  if (kind === "roaches" || kind === "dirty") return { icon: <Bug size={17} />, tone: "coral" as const };
  if (kind === "settled" || kind === "clean") return { icon: <Coins size={17} />, tone: "gold" as const };
  if (kind === "achievement") return { icon: <Medal size={17} />, tone: "gold" as const };
  if (kind === "event") return { icon: <PartyPopper size={17} />, tone: "muted" as const };
  if (kind === "purchase" || kind === "upgrade") return { icon: <Hammer size={17} />, tone: "muted" as const };
  return { icon: <Megaphone size={17} />, tone: "muted" as const };
}

/** Realça @nick e destaca quando sou eu o mencionado. */
function RichText({ text, myNick }: { text: string; myNick: string }) {
  const parts = text.split(/(@[a-z0-9_]{3,20})/gi);
  return (
    <>
      {parts.map((p, i) =>
        /^@[a-z0-9_]{3,20}$/i.test(p) ? (
          <Link
            key={i}
            href={`/quarto/${p.slice(1).toLowerCase()}`}
            className={`font-medium ${p.slice(1).toLowerCase() === myNick ? "rounded bg-gold/20 px-0.5 text-gold" : "text-gold"}`}
          >
            {p}
          </Link>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function AvisosPage() {
  const { me, guests, guestById, nickById } = useHotel();
  const presence = usePresence();
  const online = useOnlineCount();
  const [events, setEvents] = useState<LobbyEvent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("lobby_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => data && setEvents(data as LobbyEvent[]));
    supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(80)
      .then(({ data }) => data && setMessages((data as ChatMessage[]).reverse()));

    const channel = supabase
      .channel("hotel-lobby")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "lobby_events" }, (payload) =>
        setEvents((prev) => [payload.new as LobbyEvent, ...prev].slice(0, 100)),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const msg = payload.new as ChatMessage;
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg].slice(-200)));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const { data, error } = await createClient().from("chat_messages").insert({ user_id: me.id, message: text }).select().single();
    setSending(false);
    if (!error && data) {
      setDraft("");
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as ChatMessage]));
    }
  }

  const friends = guests
    .filter((g) => g.id !== me.id)
    .map((g) => ({ g, s: presence(g.id) }))
    .sort((a, b) => ["online", "away", "offline"].indexOf(a.s) - ["online", "away", "offline"].indexOf(b.s) || a.g.nickname.localeCompare(b.g.nickname));

  return (
    <div className="grid gap-4 lg:h-[calc(100vh-7.5rem)] lg:grid-cols-[1fr_1.3fr_300px]">
      {/* Avisos */}
      <section className="pixel-panel flex min-h-[420px] flex-col overflow-hidden">
        <h2 className="panel-header justify-between">
          <span className="flex items-center gap-2">
            <Radio size={16} className="text-gold" /> Central de Avisos
          </span>
          <span className="flex items-center gap-1.5 font-pixel text-[10px] uppercase text-gold">
            <span className="h-2 w-2 animate-pulse rounded-full bg-gold motion-reduce:animate-none" /> Ao vivo
          </span>
        </h2>
        <ul className="flex-1 space-y-3 overflow-y-auto p-3">
          {events.length === 0 && <li className="text-sm text-muted">O lobby está calmo… por enquanto.</li>}
          <AnimatePresence initial={false}>
            {events.map((e) => {
              const ic = eventIcon(e.kind);
              return (
                <motion.li
                  key={e.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-3 rounded-md border-2 border-line bg-deep/60 p-3"
                >
                  <IconBox tone={ic.tone}>{ic.icon}</IconBox>
                  <div className="min-w-0">
                    <p className="text-[14px] leading-snug">
                      <RichText text={stripEmoji(e.message)} myNick={me.nickname} />
                    </p>
                    <span className="font-pixel text-[11px] text-muted">{formatTime(e.created_at)}</span>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </section>

      {/* Chat */}
      <section className="pixel-panel flex min-h-[460px] flex-col overflow-hidden">
        <h2 className="panel-header justify-between">
          <span className="flex items-center gap-2">
            <MessagesSquare size={16} className="text-gold" /> Chat Global do Lobby
          </span>
          <span className="font-body text-xs text-muted">{online} online</span>
        </h2>
        <div ref={chatRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && <p className="text-sm text-muted">Ninguém falou nada ainda. Puxa o assunto!</p>}
          {messages.map((m) => {
            const g = guestById.get(m.user_id);
            const mine = m.user_id === me.id;
            const mentioned = m.mentions_json?.some((x) => x.id === me.id);
            return (
              <div key={m.id} className="flex items-end gap-2.5">
                <Initial guest={g} size={24} />
                <div className="min-w-0">
                  <div className="mb-0.5 text-xs">
                    <span className={`font-pixel ${mine ? "text-gold" : "text-cream"}`}>@{nickById.get(m.user_id) ?? "hóspede"}</span>
                    <span className="ml-2 text-muted">{formatTime(m.created_at)}</span>
                  </div>
                  <div className={`inline-block max-w-full break-words rounded-md border-2 px-3 py-2 text-[14px] ${mentioned ? "border-gold/60 bg-gold/10" : "border-line bg-deep/70"}`}>
                    <RichText text={m.message} myNick={me.nickname} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 border-t-2 border-line p-3">
          <MentionInput value={draft} onChange={setDraft} onSubmit={send} guests={guests.filter((g) => g.id !== me.id)} disabled={sending} placeholder="Digite @ para mencionar um amigo..." />
          <button className="pixel-btn pixel-btn-gold w-11 shrink-0 p-0" onClick={send} disabled={sending || !draft.trim()} aria-label="Enviar">
            <SendHorizontal size={17} />
          </button>
        </div>
      </section>

      {/* Lateral */}
      <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto">
        <QuickCharge />
        <section className="pixel-panel overflow-hidden">
          <h2 className="panel-header">
            <Users size={16} className="text-gold" /> Amigos no Hotel
          </h2>
          <ul className="space-y-1 p-3">
            {friends.length === 0 && <li className="text-sm text-muted">Convide a galera para o hotel.</li>}
            {friends.map(({ g, s }) => (
              <li key={g.id}>
                <Link href={`/quarto/${g.nickname}`} className="flex items-center gap-2.5 rounded px-1 py-1.5 hover:bg-panel2">
                  <Initial guest={g} size={24} />
                  <span className="font-pixel text-[13px]">@{g.nickname}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">{g.full_name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <span className={`h-2 w-2 rounded-full ${PRESENCE_DOT[s]}`} />
                    {s === "online" ? "Online" : s === "away" ? "Ausente" : "Offline"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
