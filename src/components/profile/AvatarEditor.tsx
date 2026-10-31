"use client";

import { Avatar } from "@/components/room/Avatar";
import { PREMIUM_STYLES } from "@/lib/constants";
import type { AvatarConfig, HairStyle, HatStyle, PantsStyle, ShirtStyle } from "@/lib/types";

const SKINS = ["#f6d7b8", "#f1c27d", "#d9a066", "#b07a4f", "#8a5a3b", "#5c3a24"];
const COLORS = ["#1d1d24", "#3b2a1a", "#8a4b23", "#d9a441", "#e8e0c8", "#c0453c", "#4a7bd1", "#3f9b4f", "#7b4fc0", "#ef6b5b", "#f2b84b", "#2f3e66"];

const OPTIONS = {
  hair: [
    ["short", "Curto"],
    ["long", "Longo"],
    ["spiky", "Espetado"],
    ["bald", "Careca"],
  ] as [HairStyle, string][],
  shirt: [
    ["tshirt", "Camiseta"],
    ["tank", "Regata"],
    ["hoodie", "Moletom"],
    ["jacket", "Jaqueta"],
  ] as [ShirtStyle, string][],
  pants: [
    ["jeans", "Calça"],
    ["shorts", "Bermuda"],
  ] as [PantsStyle, string][],
  hat: [
    ["none", "Nenhum"],
    ["cap", "Boné"],
    ["crown", "Coroa"],
  ] as [HatStyle, string][],
};

interface AvatarEditorProps {
  value: AvatarConfig;
  onChange: (v: AvatarConfig) => void;
  /** asset_url das roupas premium já compradas. */
  ownedStyles: Set<string>;
}

export function AvatarEditor({ value, onChange, ownedStyles }: AvatarEditorProps) {
  const set = <K extends keyof AvatarConfig>(k: K, v: AvatarConfig[K]) => onChange({ ...value, [k]: v });

  const StyleRow = <K extends "hair" | "shirt" | "pants" | "hat">({ field, label }: { field: K; label: string }) => (
    <div>
      <span className="pixel-label">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {(OPTIONS[field] as [string, string][]).map(([key, text]) => {
          const locked = PREMIUM_STYLES.has(key) && !ownedStyles.has(key);
          return (
            <button
              key={key}
              type="button"
              disabled={locked}
              title={locked ? "Item premium — compre na Loja" : undefined}
              onClick={() => set(field, key as AvatarConfig[K])}
              className={`pixel-btn px-2 py-1 text-xs ${value[field] === key ? "pixel-btn-gold" : ""}`}
            >
              {locked && "🔒 "}
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );

  const ColorRow = ({ field, label, palette }: { field: "skin" | "hairColor" | "shirtColor" | "pantsColor"; label: string; palette: string[] }) => (
    <div>
      <span className="pixel-label">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {palette.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`${label} ${c}`}
            onClick={() => set(field, c)}
            className={`h-7 w-7 rounded border-2 ${value[field] === c ? "border-gold" : "border-black/40"}`}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
      <div className="flex items-center justify-center rounded border-2 border-line bg-[#cbb48a] p-4">
        <div className="animate-bob">
          <Avatar config={value} size={112} />
        </div>
      </div>
      <div className="space-y-3">
        <ColorRow field="skin" label="Pele" palette={SKINS} />
        <StyleRow field="hair" label="Cabelo" />
        <ColorRow field="hairColor" label="Cor do cabelo" palette={COLORS} />
        <StyleRow field="shirt" label="Camisa" />
        <ColorRow field="shirtColor" label="Cor da camisa" palette={COLORS} />
        <StyleRow field="pants" label="Calça" />
        <ColorRow field="pantsColor" label="Cor da calça" palette={COLORS} />
        <StyleRow field="hat" label="Chapéu" />
      </div>
    </div>
  );
}
