"use client";

import { useMemo, useRef, useState } from "react";
import type { NickEntry } from "@/lib/types";

interface MentionInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  guests: NickEntry[];
  disabled?: boolean;
  placeholder?: string;
}

/** Campo de chat com auto-complete ao digitar "@". */
export function MentionInput({ value, onChange, onSubmit, guests, disabled, placeholder }: MentionInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Token "@xyz" imediatamente antes do cursor
  const token = useMemo(() => {
    const before = value.slice(0, caret);
    const m = before.match(/(^|\s)@([a-z0-9_]{0,20})$/i);
    return m ? { query: m[2].toLowerCase(), start: before.length - m[2].length - 1 } : null;
  }, [value, caret]);

  const suggestions = useMemo(() => {
    if (!token || dismissed) return [];
    return guests
      .filter((g) => g.nickname.startsWith(token.query) || g.full_name.toLowerCase().includes(token.query))
      .slice(0, 6);
  }, [token, guests, dismissed]);

  function pick(nick: string) {
    if (!token) return;
    const next = `${value.slice(0, token.start)}@${nick} ${value.slice(caret)}`;
    onChange(next);
    const pos = token.start + nick.length + 2;
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(pos, pos);
      setCaret(pos);
    });
    setActive(0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        return setActive((a) => (a + 1) % suggestions.length);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        return setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        return pick(suggestions[Math.min(active, suggestions.length - 1)].nickname);
      }
      if (e.key === "Escape") return setDismissed(true);
    }
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="relative flex-1">
      {suggestions.length > 0 && (
        <ul className="absolute bottom-full left-0 z-20 mb-1 w-full overflow-hidden rounded border-2 border-line bg-panel2 shadow-lg" role="listbox">
          {suggestions.map((g, i) => (
            <li key={g.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(g.nickname);
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm ${
                  i === active ? "bg-gold text-night" : "hover:bg-panel"
                }`}
              >
                <span>@{g.nickname}</span>
                <span className="truncate pl-2 text-xs opacity-70">{g.full_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={inputRef}
        className="pixel-input"
        value={value}
        disabled={disabled}
        maxLength={500}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart ?? e.target.value.length);
          setDismissed(false);
          setActive(0);
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
        onKeyDown={onKeyDown}
        aria-autocomplete="list"
      />
    </div>
  );
}
