import { shade } from "@/lib/color";
import type { NickEntry } from "@/lib/types";

/** Quadradinho com a inicial do hóspede, na cor da camisa do avatar. */
export function Initial({ guest, size = 24 }: { guest?: Pick<NickEntry, "nickname" | "avatar_config"> | null; size?: number }) {
  const color = guest?.avatar_config?.shirtColor ?? "#64748b";
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-[4px] border-2 font-pixel text-night"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: color,
        borderColor: shade(color, -0.35),
      }}
      title={guest ? `@${guest.nickname}` : undefined}
      aria-hidden
    >
      {(guest?.nickname ?? "?").charAt(0).toUpperCase()}
    </span>
  );
}

/** Ícone dentro de um quadrado com borda, como nos cards dos mockups. */
export function IconBox({ children, tone = "gold" }: { children: React.ReactNode; tone?: "gold" | "coral" | "muted" }) {
  const cls = tone === "gold" ? "border-gold/60 text-gold" : tone === "coral" ? "border-coral/60 text-coral" : "border-line text-muted";
  return <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md border-2 bg-deep ${cls}`}>{children}</span>;
}

/** Rótulo de limpeza usado no diretório e no quarto. */
export function cleanlinessBadge(score: number): { label: string; cls: string } {
  if (score >= 90) return { label: "Impecável", cls: "border-mint/60 text-mint" };
  if (score >= 75) return { label: "Arrumado", cls: "border-sky/60 text-sky" };
  if (score >= 50) return { label: "Bagunçado", cls: "border-gold/60 text-gold" };
  if (score >= 20) return { label: "Teias de aranha", cls: "border-coral/60 text-coral" };
  return { label: "Calamidade", cls: "border-coral text-coral" };
}
