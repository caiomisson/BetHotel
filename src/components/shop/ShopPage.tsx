"use client";

import { motion } from "framer-motion";
import { Armchair, Coins, Hammer, Shirt, Sofa, Store, Tv } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHotel } from "@/components/hotel/HotelProvider";
import { Avatar } from "@/components/room/Avatar";
import { FURNITURE_SPRITES, FurnitureSvg, spriteBox } from "@/components/room/sprites";
import { DEFAULT_AVATAR, SHOP_SECTIONS } from "@/lib/constants";
import { errorMessage } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { AvatarConfig, ShopItem, ShopSection } from "@/lib/types";

const SECTION_ICON: Record<string, typeof Hammer> = {
  reforma: Hammer,
  basica: Armchair,
  conforto: Sofa,
  eletronicos: Tv,
  vestuario: Shirt,
};

const DESCRIPTIONS: Record<string, string> = {
  paint_simple: "Cobre o reboco descascado com uma demão lisa de tinta. A cor você escolhe depois.",
  paint_texture: "Parede de tijolinho aparente, estilo loft de quem ganha apostas. Inclui relevo 3D.",
  led_lamp: "Chega de pisca-pisca. Luz quente e estável no quarto.",
  plant: "Resistente como seu saldo depois de uma sequência de derrotas.",
  rug: "Losangos dourados sobre azul-petróleo.",
  lamp: "Um cantinho de luz para ler os termos da aposta.",
  table: "Lugar oficial para apoiar o açaí do racha.",
  armchair: "Estofado verde-musgo. Clique nela no quarto para sentar.",
  sofa_mode: "Dois lugares — um para você, outro para quem te deve.",
  bed_double: "Cabeceira estofada, colcha mostarda e dois travesseiros.",
  rug_large: "Vinho com borda dourada. Unifica o quarto.",
  bookshelf: "Livros de estatística e uns mangás escondidos.",
  meeting_table: "Para negociar odds e acertar as contas olho no olho.",
  stereo: "Toca o hino do time vencedor no volume máximo.",
  tv_plasma: "42 polegadas de jogos ao vivo e replays de gols polêmicos.",
  snack_machine: "Salgadinho infinito para as madrugadas de apostas.",
  trophy_case: "Exibe um troféu dourado para cada aposta vencida. Clique nela para ver suas estatísticas.",
  sunglasses: "Esconde a cara de quem acabou de perder no pênalti.",
  cap: "Boné de aba reta. Escolha a cor no seu Perfil.",
  hoodie: "Moletom para as noites frias do lobby.",
  crown: "Item raro. Para quem domina o ranking do hotel.",
};

const RARE = new Set(["crown"]);

/** Ícones das reformas, no estilo dos mockups. */
function RenovationArt({ asset }: { asset: string }) {
  if (asset === "led_lamp") {
    return (
      <svg width={90} height={90} viewBox="0 0 60 60" aria-hidden>
        <defs>
          <radialGradient id="led-shop">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
          </radialGradient>
        </defs>
        <line x1={30} y1={0} x2={30} y2={26} stroke="#94a3b8" strokeWidth={1.5} />
        <circle cx={30} cy={34} r={22} fill="url(#led-shop)" />
        <rect x={26} y={24} width={8} height={5} fill="#334155" />
        <circle cx={30} cy={35} r={7} fill="#fde68a" stroke="#f59e0b" strokeWidth={1.5} />
        <rect x={28} y={32} width={1.5} height={5} fill="#b45309" />
        <rect x={31} y={32} width={1.5} height={5} fill="#b45309" />
      </svg>
    );
  }
  const brick = asset === "paint_texture";
  return (
    <svg width={90} height={90} viewBox="0 0 60 60" aria-hidden>
      <defs>
        <pattern id={`shop-${asset}`} width={10} height={6} patternUnits="userSpaceOnUse" patternTransform="skewY(26.565)">
          <rect width={10} height={6} fill={brick ? "#b45a3c" : "#5b7398"} />
          {brick && <path d="M0 .5H10M0 3.5H10M3 .5V3.5M8 3.5V6" stroke="#6e3221" strokeWidth={0.8} />}
        </pattern>
      </defs>
      <polygon points="12,6 48,24 48,54 12,36" fill={`url(#shop-${asset})`} stroke="#1e293b" strokeWidth={1.5} />
      <polygon points="12,36 48,54 48,58 12,40" fill="#3a2a19" />
    </svg>
  );
}

function ItemArt({ item, avatar }: { item: ShopItem; avatar: AvatarConfig }) {
  if (item.category === "renovation") return <RenovationArt asset={item.asset_url} />;
  if (item.category === "furniture") {
    const def = FURNITURE_SPRITES[item.asset_url];
    if (!def) return null;
    const box = spriteBox(def, 0);
    return <FurnitureSvg asset={item.asset_url} scale={Math.min(130 / box.width, 92 / box.height, 1.4)} trophies={3} />;
  }
  const preview: AvatarConfig = { ...DEFAULT_AVATAR, ...avatar, hat: "none", glasses: "none" };
  if (item.asset_url === "hoodie") preview.shirt = "hoodie";
  if (item.asset_url === "cap") {
    preview.hat = "cap";
    preview.hatColor = avatar.hatColor ?? "#f59e0b";
  }
  if (item.asset_url === "crown") preview.hat = "crown";
  if (item.asset_url === "sunglasses") preview.glasses = "sunglasses";
  return <Avatar config={preview} size={84} />;
}

export function ShopPage({ items }: { items: ShopItem[] }) {
  const { me, myRoom } = useHotel();
  const router = useRouter();
  const [tab, setTab] = useState<ShopSection>("reforma");
  const [buying, setBuying] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const wardrobe = new Set(myRoom.inventory_json.wardrobe ?? []);
  const upgrades = new Set(myRoom.inventory_json.upgrades ?? []);
  const owned = new Map<string, number>();
  (myRoom.inventory_json.furniture ?? []).forEach((f) => owned.set(f.item_id, (owned.get(f.item_id) ?? 0) + 1));

  async function buy(item: ShopItem) {
    setBuying(item.id);
    setMessage(null);
    const { error } = await createClient().rpc("buy_item", { p_item: item.id });
    setBuying(null);
    if (error) return setMessage({ text: errorMessage(error), ok: false });
    setMessage({
      text:
        item.category === "renovation"
          ? `${item.name} aplicada no seu quarto!`
          : item.category === "furniture"
            ? `${item.name} foi para o inventário. Em Meu Quarto → Inventário → Decorar você posiciona.`
            : `${item.name} está no guarda-roupa. Vista no seu Perfil (clique no avatar lá em cima).`,
      ok: true,
    });
    router.refresh();
  }

  const section = SHOP_SECTIONS.find((s) => s.key === tab)!;
  const list = items.filter((i) => i.section === tab);

  return (
    <section className="pixel-panel mx-auto max-w-[1150px] overflow-hidden border-gold/50">
      <header className="flex flex-wrap items-center gap-3 border-b-2 border-gold/40 bg-panel2/70 px-4 py-3">
        <span className="grid h-10 w-10 place-items-center rounded-md border-2 border-gold text-gold">
          <Store size={18} />
        </span>
        <div>
          <h1 className="font-pixel text-lg">Catálogo do Hotel</h1>
          <p className="text-sm text-muted">Gaste suas Hotel Coins e reforme o quarto.</p>
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-md border-2 border-line bg-deep px-3 py-2 text-sm">
          Saldo <Coins size={15} className="text-gold" />
          <span className="font-pixel text-gold">{me.hotel_coins}</span>
        </div>
      </header>

      <div className="grid md:grid-cols-[230px_1fr]">
        <nav className="flex gap-1 overflow-x-auto border-b-2 border-line p-3 md:flex-col md:border-b-0 md:border-r-2" aria-label="Categorias">
          {SHOP_SECTIONS.map((s) => {
            const Icon = SECTION_ICON[s.key];
            const on = s.key === tab;
            return (
              <button
                key={s.key}
                onClick={() => {
                  setTab(s.key);
                  setMessage(null);
                }}
                className={`flex shrink-0 items-center gap-2.5 rounded-md border-2 px-3 py-2.5 text-left font-pixel text-sm transition ${
                  on ? "border-gold bg-gold/10 text-gold" : "border-transparent text-muted hover:text-cream"
                }`}
              >
                <Icon size={16} />
                {s.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4">
          <h2 className="font-pixel text-base">{section.label}</h2>
          <p className="mb-4 text-sm text-muted">{section.hint}</p>
          {message && <p className={`mb-3 rounded-md border-2 px-3 py-2 text-sm ${message.ok ? "border-mint/40 text-mint" : "border-coral/40 text-coral"}`}>{message.text}</p>}

          <motion.ul key={tab} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }}>
            {list.map((item) => {
              const have = (item.category === "clothing" && wardrobe.has(item.id)) || (item.category === "renovation" && upgrades.has(item.asset_url));
              const count = owned.get(item.id) ?? 0;
              const affordable = me.hotel_coins >= item.price_coins;
              return (
                <motion.li
                  key={item.id}
                  variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                  whileHover={{ y: -3 }}
                  className="relative flex flex-col overflow-hidden rounded-md border-2 border-line bg-deep/60"
                >
                  {RARE.has(item.asset_url) && <span className="tag absolute left-2 top-2 z-10 border-gold text-gold">Raro</span>}
                  <div className="flex h-28 items-center justify-center bg-panel2/60">
                    <ItemArt item={item} avatar={me.avatar_config} />
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <h3 className="text-[15px] font-semibold leading-snug">{item.name}</h3>
                    <p className="line-clamp-2 text-[13px] leading-snug text-muted">{DESCRIPTIONS[item.asset_url]}</p>
                    {item.size_x * item.size_y > 1 && (
                      <p className="text-[11px] text-muted">
                        Ocupa {item.size_x}×{item.size_y} pisos · gira
                      </p>
                    )}
                    {count > 0 && <p className="text-[11px] text-mint">Você tem {count}</p>}
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="flex items-center gap-1 font-pixel text-gold">
                        <Coins size={14} /> {item.price_coins}
                      </span>
                      <button
                        className={`pixel-btn px-3 py-1.5 text-xs ${have ? "" : affordable ? "pixel-btn-gold" : "pixel-btn-ghost"}`}
                        disabled={have || !affordable || buying === item.id}
                        onClick={() => buy(item)}
                      >
                        {have ? (item.category === "renovation" ? "Aplicado" : "Comprado") : buying === item.id ? "…" : "Comprar"}
                      </button>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </motion.ul>
          <p className="mt-4 text-xs text-muted">Ganhe Hotel Coins vencendo apostas (ao receber cada pagamento) e quitando eventos (pela sua parte de cada gasto).</p>
        </div>
      </div>
    </section>
  );
}
