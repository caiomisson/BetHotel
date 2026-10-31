/** Clareia (amt > 0) ou escurece (amt < 0) uma cor hex. amt em [-1, 1]. */
export function shade(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const target = amt < 0 ? 0 : 255;
    return Math.round(c + (target - c) * Math.abs(amt));
  });
  return `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
