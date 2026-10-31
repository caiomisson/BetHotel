"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useHotel } from "@/components/hotel/HotelProvider";
import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/format";
import type { ChatMessage, LobbyEvent } from "@/lib/types";
import { MentionInput } from "./MentionInput";

type Tab = "avisos" | "chat";

/** Realça @nick no texto e destaca quando sou eu o mencionado. */
function RichText({ text, myNick }: { text: string; myNick: string }) {
  const parts = text.split(/(@[a-z0-9_]{3,20})/gi);
  return (
    <>
      {parts.map((p, i) =>
        /^@[a-z0-9_]{3,20}$/i.test(p) ? (
          <Link
            key={i}
            href={`/quarto/${p.slice(1).toLowerCase()}`}
            className={`font-semibold ${p.slice(1).toLowerCase() === myNick ? "rounded bg-gold px-0.5 text-night" : "text-sky"}`}
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

/** Central de Avisos do Hotel: feed automático + chat global em tempo real. */
export function LobbyPanel() {
  const { me, guests, nickById } = useHotel();
  const [tab, setTab] = useState<Tab>("avisos");
  const [events, setEvents] = useState<LobbyEvent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState({ avisos: 0, chat: 0 });
  const tabRef = useRef<Tab>(tab);
  const listRef = useRef<HTMLDivElement>(null);
  tabRef.current = tab;

  useEffect(() => {
    const supabase = createClient();

    supabase
      .from("lobby_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40)
      .then(({ data }) => data && setEvents(data as LobbyEvent[]));

    supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60)
      .then(({ data }) => data && setMessages((data as ChatMessage[]).reverse()));

    const channel = supabase
      .channel("hotel-lobby")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "lobby_events" }, (payload) => {
        setEvents((prev) => [payload.new as LobbyEvent, ...prev].slice(0, 80));
        if (tabRef.current !== "avisos") setUnread((u) => ({ ...u, avisos: u.avisos + 1 }));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const msg = payload.new as ChatMessage;
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg].slice(-150)));
        if (tabRef.current !== "chat") setUnread((u) => ({ ...u, chat: u.chat + 1 }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (tab === "chat") listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, tab]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const { data, error } = await createClient()
      .from("chat_messages")
      .insert({ user_id: me.id, message: text })
      .select()
      .single();
    setSending(false);
    if (!error && data) {
      setDraft("");
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as ChatMessage]));
    }
  }

  const switchTab = (t: Tab) => {
    setTab(t);
    setUnread((u) => ({ ...u, [t]: 0 }));
  };

  return (
    <aside className="pixel-panel flex h-[520px] flex-col overflow-hidden lg:sticky lg:top-4 lg:h-[calc(100vh-7rem)]">
      <div className="flex border-b-2 border-line bg-panel2">
        {(["avisos", "chat"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={`flex-1 px-3 py-2.5 font-pixel text-[10px] uppercase ${tab === t ? "bg-panel text-gold" : "text-cream/70"}`}
          >
            {t === "avisos" ? "📢 Avisos" : "💬 Chat"}
            {unread[t] > 0 && <span className="ml-1 rounded bg-coral px-1 text-night">{unread[t]}</span>}
          </button>
        ))}
      </div>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {tab === "avisos" &&
          (events.length === 0 ? (
            <p className="text-cream/50">O lobby está calmo… por enquanto.</p>
          ) : (
            events.map((e) => (
              <div
                key={e.id}
                className={`rounded border-l-4 bg-night/40 px-2 py-1.5 ${
                  e.kind === "dirty" ? "border-coral" : e.kind === "settled" || e.kind === "clean" ? "border-mint" : "border-gold"
                }`}
              >
                <RichText text={e.message} myNick={me.nickname} />
                <div className="text-[10px] text-cream/40">{formatTime(e.created_at)}</div>
              </div>
            ))
          ))}

        {tab === "chat" &&
          messages.map((m) => {
            const mentioned = m.mentions_json?.some((x) => x.id === me.id);
            const nick = nickById.get(m.user_id) ?? "hóspede";
            return (
              <div key={m.id} className={`rounded px-2 py-1 ${mentioned ? "bg-gold/15 ring-1 ring-gold/50" : ""}`}>
                <span className={`font-semibold ${m.user_id === me.id ? "text-gold" : "text-mint"}`}>@{nick}</span>
                <span className="ml-1 text-[10px] text-cream/40">{formatTime(m.created_at)}</span>
                <div className="break-words">
                  <RichText text={m.message} myNick={me.nickname} />
                </div>
              </div>
            );
          })}
      </div>

      {tab === "chat" && (
        <div className="flex gap-2 border-t-2 border-line p-2">
          <MentionInput
            value={draft}
            onChange={setDraft}
            onSubmit={send}
            guests={guests.filter((g) => g.id !== me.id)}
            disabled={sending}
            placeholder="Digite… use @ para mencionar"
          />
          <button className="pixel-btn pixel-btn-gold" onClick={send} disabled={sending || !draft.trim()}>
            Enviar
          </button>
        </div>
      )}
    </aside>
  );
}
