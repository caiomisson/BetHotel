"use client";

import { motion } from "framer-motion";
import { ArrowRight, Search, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/room/Avatar";
import { cleanlinessBadge } from "@/components/ui/Bits";
import { formatBRL } from "@/lib/format";
import type { RankingEntry } from "@/lib/types";
import { useHotel } from "./HotelProvider";
import { PRESENCE_DOT, PRESENCE_LABEL, usePresence } from "./PresenceProvider";

export interface DirectoryEntry {
  cleanliness_score: number;
  user_id: string;
}

type Sort = "nome" | "ranking";

export function DirectoryList({ rooms, ranking }: { rooms: DirectoryEntry[]; ranking: RankingEntry[] }) {
  const { me, guests, ledger } = useHotel();
  const presence = usePresence();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("nome");

  const scoreById = useMemo(() => new Map(rooms.map((r) => [r.user_id, r.cleanliness_score])), [rooms]);
  const rankById = useMemo(() => new Map(ranking.map((r) => [r.user_id, r])), [ranking]);

  const term = q.trim().toLowerCase().replace(/^@/, "");
  const list = guests
    .filter((g) => g.id !== me.id)
    .filter((g) => !term || g.nickname.includes(term) || g.full_name.toLowerCase().includes(term))
    .sort((a, b) => {
      if (sort === "ranking") {
        const ra = rankById.get(a.id)?.rank ?? 1e9;
        const rb = rankById.get(b.id)?.rank ?? 1e9;
        if (ra !== rb) return ra - rb;
      }
      return a.nickname.localeCompare(b.nickname);
    });

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-pixel text-2xl">
            <Users size={22} className="text-gold" /> Diretório de Hóspedes
          </h1>
          <p className="text-sm text-muted">Visite o quarto dos amigos e veja quem está em dia com as contas.</p>
        </div>
        <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="flex rounded-md border-2 border-line p-0.5">
            {(["nome", "ranking"] as Sort[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`flex items-center gap-1 rounded px-2.5 py-1.5 font-pixel text-xs ${sort === s ? "bg-gold text-night" : "text-muted"}`}
              >
                {s === "ranking" && <Trophy size={12} />}
                {s === "nome" ? "A–Z" : "Ranking"}
              </button>
            ))}
          </div>
          <label className="relative min-w-[240px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="pixel-input py-2.5 pl-9" placeholder="Buscar @nick ou nome..." value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
      </div>

      <motion.ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
        {list.map((g) => {
          const status = presence(g.id);
          const score = scoreById.get(g.id) ?? 100;
          const clean = cleanlinessBadge(score);
          const net = ledger.netByPerson.get(g.id) ?? 0;
          const rank = rankById.get(g.id);
          const tint = g.avatar_config.shirtColor ?? "#3b82f6";
          return (
            <motion.li key={g.id} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="pixel-panel flex flex-col overflow-hidden">
              <div
                className="pixel-grid-bg relative flex h-32 items-end justify-center"
                style={{ background: `linear-gradient(135deg, ${tint}26, transparent 70%), #16203a` }}
              >
                <span className="tag absolute left-2.5 top-2.5 border-line bg-night/80 normal-case text-cream/80">Quarto {g.room_number ?? "—"}</span>
                <span className="absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded bg-night/80 px-2 py-0.5 text-xs">
                  <span className={`h-2 w-2 rounded-full ${PRESENCE_DOT[status]}`} />
                  {PRESENCE_LABEL[status]}
                </span>
                {rank && rank.rank <= 10 && (
                  <span className="tag absolute bottom-2.5 left-2.5 border-gold/70 bg-night/80 text-gold">
                    <Trophy size={10} /> #{rank.rank}
                  </span>
                )}
                <div className="mb-2 flex flex-col items-center">
                  <Avatar config={g.avatar_config} size={76} />
                  <span className="-mt-1 h-2 w-9 rounded-[50%] bg-black/45" />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3.5">
                <div>
                  <div className="font-pixel text-base">@{g.nickname}</div>
                  <div className="text-sm text-muted">{g.full_name}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className={`tag normal-case ${clean.cls}`}>
                    {clean.label} · {score}%
                  </span>
                  {net < 0 && <span className="tag border-coral/60 normal-case text-coral">Você deve {formatBRL(-net)}</span>}
                  {net > 0 && <span className="tag border-mint/60 normal-case text-mint">Te deve {formatBRL(net)}</span>}
                </div>
                {g.bio && <p className="text-[13px] italic text-cream/65">&ldquo;{g.bio}&rdquo;</p>}
                <Link href={`/quarto/${g.nickname}`} className="pixel-btn pixel-btn-gold mt-auto py-2.5">
                  Visitar <ArrowRight size={15} />
                </Link>
              </div>
            </motion.li>
          );
        })}
      </motion.ul>
      {list.length === 0 && <p className="py-10 text-center text-sm text-muted">Nenhum hóspede encontrado.</p>}
    </section>
  );
}
