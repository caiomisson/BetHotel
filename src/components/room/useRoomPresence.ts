"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AvatarConfig } from "@/lib/types";
import type { AvatarState, RemoteAvatar, SpeechBubble } from "./IsoRoom";

interface PresencePayload extends AvatarState {
  nickname: string;
  config: AvatarConfig;
}

const BUBBLE_MS = 6000;

/**
 * Multiplayer do quarto (Supabase Realtime):
 *  - presence: quem está no quarto e onde (posição, direção, assento)
 *  - broadcast "say": balões de fala (não ficam salvos no banco)
 */
export function useRoomPresence(roomKey: string, me: { id: string; nickname: string; config: AvatarConfig }) {
  const [others, setOthers] = useState<RemoteAvatar[]>([]);
  const [bubbles, setBubbles] = useState<SpeechBubble[]>([]);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const lastState = useRef<AvatarState | null>(null);
  const ready = useRef(false);
  const meRef = useRef(me);
  meRef.current = me;

  const addBubble = useCallback((b: SpeechBubble) => {
    setBubbles((prev) => [...prev.slice(-20), b]);
    setTimeout(() => setBubbles((prev) => prev.filter((x) => x.id !== b.id)), BUBBLE_MS);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`room:${roomKey}`, { config: { presence: { key: me.id }, broadcast: { self: false } } });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresencePayload>();
        const list: RemoteAvatar[] = [];
        for (const [userId, metas] of Object.entries(state)) {
          if (userId === meRef.current.id) continue;
          const m = metas[metas.length - 1];
          if (!m) continue;
          list.push({ userId, nickname: m.nickname, config: m.config, x: m.x, y: m.y, dir: m.dir, seat: m.seat, walking: m.walking });
        }
        setOthers(list);
      })
      .on("broadcast", { event: "say" }, ({ payload }) => addBubble(payload as SpeechBubble))
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        ready.current = true;
        if (lastState.current) channel.track({ ...lastState.current, nickname: meRef.current.nickname, config: meRef.current.config });
      });

    return () => {
      ready.current = false;
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomKey, me.id, addBubble]);

  /** Publica minha posição (chamado a cada passo). */
  const publish = useCallback((s: AvatarState) => {
    lastState.current = s;
    if (ready.current) channelRef.current?.track({ ...s, nickname: meRef.current.nickname, config: meRef.current.config });
  }, []);

  /** Fala no quarto: balão sobre a minha cabeça para todos. */
  const say = useCallback(
    (text: string, color: string) => {
      const clean = text.trim().slice(0, 120);
      if (!clean) return;
      const b: SpeechBubble = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, userId: meRef.current.id, text: clean, color };
      addBubble(b);
      channelRef.current?.send({ type: "broadcast", event: "say", payload: b });
    },
    [addBubble],
  );

  return { others, bubbles, publish, say };
}
