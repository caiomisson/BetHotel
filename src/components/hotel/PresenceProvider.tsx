"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PresenceStatus = "online" | "away" | "offline";

const PresenceContext = createContext<Map<string, PresenceStatus>>(new Map());

const AWAY_AFTER_MS = 5 * 60 * 1000;

/**
 * Presença em tempo real (Supabase Realtime Presence):
 *  - online: aba aberta e em uso
 *  - away (ausente): aba em segundo plano ou 5 min sem interação
 *  - offline: não está com o site aberto
 */
export function PresenceProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [statuses, setStatuses] = useState<Map<string, PresenceStatus>>(new Map());

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("hotel-presence", { config: { presence: { key: userId } } });
    let current: PresenceStatus = document.hidden ? "away" : "online";
    let idleTimer: ReturnType<typeof setTimeout>;

    const publish = (s: PresenceStatus) => {
      if (s === current) return;
      current = s;
      channel.track({ status: s });
    };
    const resetIdle = () => {
      clearTimeout(idleTimer);
      if (!document.hidden) publish("online");
      idleTimer = setTimeout(() => publish("away"), AWAY_AFTER_MS);
    };
    const onVisibility = () => (document.hidden ? publish("away") : resetIdle());

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ status: PresenceStatus }>();
        const next = new Map<string, PresenceStatus>();
        for (const [key, metas] of Object.entries(state)) {
          next.set(key, metas.some((m) => m.status === "online") ? "online" : "away");
        }
        setStatuses(next);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") channel.track({ status: current });
      });

    const events = ["mousemove", "keydown", "pointerdown", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, resetIdle, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    resetIdle();

    return () => {
      clearTimeout(idleTimer);
      events.forEach((e) => window.removeEventListener(e, resetIdle));
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return <PresenceContext.Provider value={statuses}>{children}</PresenceContext.Provider>;
}

export function usePresence(): (userId: string) => PresenceStatus {
  const map = useContext(PresenceContext);
  return (id: string) => map.get(id) ?? "offline";
}

export function useOnlineCount(): number {
  const map = useContext(PresenceContext);
  return [...map.values()].filter((s) => s === "online").length;
}

export const PRESENCE_LABEL: Record<PresenceStatus, string> = { online: "online", away: "ausente", offline: "offline" };
export const PRESENCE_DOT: Record<PresenceStatus, string> = { online: "bg-mint", away: "bg-gold", offline: "bg-muted" };
