"use client";

import { useState } from "react";
import type { NickEntry } from "@/lib/types";

interface GuestPickerProps {
  guests: NickEntry[];
  selected: string[];
  onChange: (ids: string[]) => void;
  single?: boolean;
  placeholder?: string;
}

/** Busca de hóspedes por @nick com chips de selecionados. */
export function GuestPicker({ guests, selected, onChange, single, placeholder }: GuestPickerProps) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase().replace(/^@/, "");
  const matches = term
    ? guests.filter((g) => !selected.includes(g.id) && (g.nickname.includes(term) || g.full_name.toLowerCase().includes(term))).slice(0, 5)
    : [];
  const byId = new Map(guests.map((g) => [g.id, g]));

  const add = (id: string) => {
    onChange(single ? [id] : [...selected, id]);
    setQ("");
  };

  return (
    <div>
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded bg-panel2 px-2 py-1 text-sm">
              @{byId.get(id)?.nickname}
              <button
                type="button"
                className="text-coral"
                onClick={() => onChange(selected.filter((s) => s !== id))}
                aria-label={`Remover ${byId.get(id)?.nickname}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      {(!single || selected.length === 0) && (
        <div className="relative">
          <input className="pixel-input" placeholder={placeholder ?? "Buscar @nick"} value={q} onChange={(e) => setQ(e.target.value)} />
          {matches.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded border-2 border-line bg-panel2">
              {matches.map((g) => (
                <li key={g.id}>
                  <button type="button" className="w-full px-3 py-1.5 text-left text-sm hover:bg-panel" onClick={() => add(g.id)}>
                    @{g.nickname} <span className="text-xs text-cream/60">{g.full_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
