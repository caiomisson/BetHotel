"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/room/Avatar";
import { DIRT_LABELS, dirtLevel } from "@/components/room/DirtOverlay";
import type { AvatarConfig } from "@/lib/types";

export interface DirectoryEntry {
  cleanliness_score: number;
  profiles: { id: string; nickname: string; full_name: string; avatar_config: AvatarConfig };
}

export function DirectoryList({ entries }: { entries: DirectoryEntry[] }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase().replace(/^@/, "");
  const list = entries.filter(
    (e) => !term || e.profiles.nickname.includes(term) || e.profiles.full_name.toLowerCase().includes(term),
  );

  return (
    <section className="pixel-panel p-4">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="pixel-title">Diretório de hóspedes</h1>
        <input className="pixel-input ml-auto max-w-xs" placeholder="Buscar @nick ou nome" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map(({ profiles: p, cleanliness_score }) => {
          const level = dirtLevel(cleanliness_score);
          return (
            <li key={p.id}>
              <Link
                href={`/quarto/${p.nickname}`}
                className="flex items-center gap-3 rounded border-2 border-line bg-night/40 p-3 transition hover:border-gold"
              >
                <Avatar config={p.avatar_config} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">@{p.nickname}</div>
                  <div className="truncate text-xs text-cream/60">{p.full_name}</div>
                  <div className={`text-xs ${level === 0 ? "text-mint" : level < 3 ? "text-gold" : "text-coral"}`}>
                    {level > 1 ? "🕷️ " : ""}
                    {DIRT_LABELS[level]} · {cleanliness_score}%
                  </div>
                </div>
                <span className="text-xs text-sky">Visitar →</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <p className="text-sm text-cream/60">Nenhum hóspede encontrado.</p>}
    </section>
  );
}
