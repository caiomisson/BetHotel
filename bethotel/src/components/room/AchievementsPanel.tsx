"use client";

import { Lock, Medal } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatBRL } from "@/lib/format";
import type { Achievement } from "@/lib/types";
import { FurnitureSvg } from "./sprites";

/** Conquistas com progresso; o prêmio vai automático para o inventário do quarto. */
export function AchievementsPanel({ userId, isMe, initial }: { userId: string; isMe: boolean; initial?: Achievement[] }) {
  const [list, setList] = useState<Achievement[] | null>(initial ?? null);

  useEffect(() => {
    if (initial) return;
    createClient()
      .rpc("get_achievements", { p_user: userId })
      .then(({ data }) => setList((data as Achievement[] | null) ?? []));
  }, [userId, initial]);

  if (!list) return <p className="text-sm text-muted">Carregando conquistas…</p>;
  const done = list.filter((a) => a.unlocked).length;

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 font-pixel text-base">
        <Medal size={16} className="text-gold" /> Conquistas
        <span className="font-body text-xs text-muted">
          {done} de {list.length}
        </span>
      </h3>
      {(["evento", "aposta"] as const).map((group) => (
        <div key={group}>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{group === "evento" ? "Prêmios de eventos" : "Prêmios de apostas"}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {list
              .filter((a) => a.group === group)
              .map((a) => {
                const money = a.code.startsWith("lucro");
                const pct = Math.min(100, (Number(a.current) / Number(a.target)) * 100);
                return (
                  <li key={a.code} className={`flex gap-3 rounded-md border-2 p-2.5 ${a.unlocked ? "border-gold/60 bg-gold/5" : "border-line bg-deep/50"}`}>
                    <div className={`grid h-14 w-14 shrink-0 place-items-center rounded bg-panel2/70 ${a.unlocked ? "" : "opacity-40 grayscale"}`}>
                      <FurnitureSvg asset={a.item_asset} scale={0.85} trophies={3} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 text-sm font-semibold">
                        {!a.unlocked && <Lock size={12} className="text-muted" />}
                        {a.title}
                      </div>
                      <div className="text-[11px] leading-snug text-muted">{a.rule}</div>
                      <div className="mt-0.5 text-[11px] text-gold">{a.item_name}</div>
                      {!a.unlocked && (
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded bg-night">
                            <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-muted">
                            {money ? `${formatBRL(a.current)} / ${formatBRL(a.target)}` : `${a.current}/${a.target}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
      {isMe && <p className="text-xs text-muted">Prêmios desbloqueados vão direto para Meu Quarto → Inventário / Móveis.</p>}
    </div>
  );
}
