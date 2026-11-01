"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import { formatBRL, formatDate } from "@/lib/format";
import type { UserStats } from "@/lib/types";

interface StatsModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  nickname: string;
}

export function StatsModal({ open, onClose, userId, nickname }: StatsModalProps) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStats(null);
    setError(null);
    createClient()
      .rpc("get_user_stats", { p_user: userId })
      .then(({ data, error }) => (error ? setError(error.message) : setStats(data as UserStats)));
  }, [open, userId]);

  return (
    <Modal open={open} onClose={onClose} title={`Carreira de @${nickname}`}>
      {error && <p className="text-coral">{error}</p>}
      {!stats && !error && <p className="text-cream/60">Carregando estatísticas…</p>}
      {stats && (
        <div className="space-y-4">
          <div
            className={`rounded border-2 px-3 py-2 text-sm font-semibold ${
              stats.is_compliant ? "border-mint/60 bg-mint/10 text-mint" : "border-coral/60 bg-coral/10 text-coral"
            }`}
          >
            {stats.is_compliant
              ? "✔ Adimplente — nenhuma dívida vencida"
              : `✖ Inadimplente — ${stats.overdue_count} dívida(s) vencida(s)`}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Apostas" value={String(stats.total_bets)} />
            <Stat label="Vitórias" value={`${stats.win_rate}%`} hint={`${stats.wins}/${stats.decided_bets}`} />
            <Stat label="Movimentado" value={formatBRL(stats.volume)} />
            <Stat label="Limpeza" value={`${stats.cleanliness_score}%`} />
          </div>

          <div>
            <h3 className="pixel-title mb-2">Histórico de pagamentos</h3>
            {stats.history.length === 0 ? (
              <p className="text-sm text-cream/60">Nenhum pagamento confirmado ainda.</p>
            ) : (
              <ul className="divide-y divide-line/50 rounded border-2 border-line">
                {stats.history.map((h, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span>
                      {h.direction === "paid" ? "↗ Pagou" : "↙ Recebeu de"}{" "}
                      {h.direction === "paid" && "para "}
                      <b>@{h.counterpart}</b>
                      <span className="ml-1 text-cream/50">({h.type === "bet" ? "aposta" : "conta"})</span>
                    </span>
                    <span className="text-right">
                      <span className={h.direction === "paid" ? "text-coral" : "text-mint"}>
                        {h.amount ? formatBRL(h.amount) : `🎁 ${h.prize_text}`}
                      </span>
                      <span className="block text-xs text-cream/50">{formatDate(h.confirmed_at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded border-2 border-line bg-night/50 p-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-cream/60">{label}</div>
      <div className="font-pixel text-base text-gold">{value}</div>
      {hint && <div className="text-[10px] text-cream/50">{hint}</div>}
    </div>
  );
}
