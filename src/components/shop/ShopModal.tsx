"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useHotel } from "@/components/hotel/HotelProvider";
import { Avatar } from "@/components/room/Avatar";
import { FURNITURE_SPRITES } from "@/components/room/sprites";
import { CoinAmount } from "@/components/ui/Coin";
import { Modal } from "@/components/ui/Modal";
import { WEEKLY_COIN_CAP } from "@/lib/constants";
import { errorMessage } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { AvatarConfig, ShopCategory, ShopItem } from "@/lib/types";

/** Pré-visualização do item: sprite do móvel ou avatar vestindo a roupa. */
function ItemPreview({ item, avatar }: { item: ShopItem; avatar: AvatarConfig }) {
  if (item.category === "furniture") {
    const def = FURNITURE_SPRITES[item.asset_url];
    if (!def) return null;
    return (
      <svg width={72} height={72} viewBox={`-36 ${-def.height - 6} 72 ${def.height + 26}`} aria-hidden>
        {def.render()}
      </svg>
    );
  }
  const preview: AvatarConfig = { ...avatar };
  if (item.asset_url === "jacket" || item.asset_url === "hoodie") preview.shirt = item.asset_url;
  if (item.asset_url === "cap" || item.asset_url === "crown") preview.hat = item.asset_url;
  return <Avatar config={preview} size={72} />;
}

export function ShopModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, myRoom } = useHotel();
  const router = useRouter();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [tab, setTab] = useState<ShopCategory>("furniture");
  const [buying, setBuying] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    setMessage(null);
    createClient()
      .from("shop_items")
      .select("*")
      .order("price_coins")
      .then(({ data }) => data && setItems(data as ShopItem[]));
  }, [open]);

  const wardrobe = new Set(myRoom.inventory_json.wardrobe ?? []);
  const ownedFurniture = new Map<string, number>();
  (myRoom.inventory_json.furniture ?? []).forEach((f) => ownedFurniture.set(f.item_id, (ownedFurniture.get(f.item_id) ?? 0) + 1));

  async function buy(item: ShopItem) {
    setBuying(item.id);
    setMessage(null);
    const { error } = await createClient().rpc("buy_item", { p_item: item.id });
    setBuying(null);
    if (error) return setMessage({ text: errorMessage(error), ok: false });
    setMessage({
      text:
        item.category === "furniture"
          ? `${item.name} foi para o seu inventário. Use "Decorar" no quarto para posicionar.`
          : `${item.name} está no seu guarda-roupa. Vista em Perfil.`,
      ok: true,
    });
    router.refresh();
  }

  return (
    <Modal open={open} onClose={onClose} title="🛍️ Loja do BetHotel" wide>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {(["furniture", "clothing"] as ShopCategory[]).map((c) => (
            <button key={c} className={`pixel-btn ${tab === c ? "pixel-btn-gold" : ""}`} onClick={() => setTab(c)}>
              {c === "furniture" ? "🛋️ Mobília" : "👕 Roupas"}
            </button>
          ))}
        </div>
        <div className="ml-auto text-right">
          <CoinAmount value={me.hotel_coins} />
          <p className="text-[10px] text-cream/60">Ganhe quitando dívidas · máx. {WEEKLY_COIN_CAP}/semana</p>
        </div>
      </div>

      {message && <p className={`mb-3 text-sm ${message.ok ? "text-mint" : "text-coral"}`}>{message.text}</p>}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items
          .filter((i) => i.category === tab)
          .map((item) => {
            const ownedClothing = item.category === "clothing" && wardrobe.has(item.id);
            const count = ownedFurniture.get(item.id) ?? 0;
            const affordable = me.hotel_coins >= item.price_coins;
            return (
              <li key={item.id} className="flex flex-col items-center gap-2 rounded border-2 border-line bg-night/40 p-3 text-center">
                <div className="flex h-20 items-end justify-center">
                  <ItemPreview item={item} avatar={me.avatar_config} />
                </div>
                <div className="text-sm font-semibold">{item.name}</div>
                <CoinAmount value={item.price_coins} />
                {count > 0 && <span className="text-[10px] text-cream/60">Você tem {count}</span>}
                <button
                  className={`pixel-btn w-full ${affordable && !ownedClothing ? "pixel-btn-mint" : ""}`}
                  disabled={!affordable || ownedClothing || buying === item.id}
                  onClick={() => buy(item)}
                >
                  {ownedClothing ? "No guarda-roupa" : buying === item.id ? "…" : affordable ? "Comprar" : "Sem moedas"}
                </button>
              </li>
            );
          })}
      </ul>
    </Modal>
  );
}
