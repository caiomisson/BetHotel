"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useHotel } from "@/components/hotel/HotelProvider";
import { ROOM_SIZES } from "@/lib/constants";
import { errorMessage } from "@/lib/format";
import { roomGeometry } from "@/lib/iso";
import { createClient } from "@/lib/supabase/client";
import type { FurniturePlacement, PublicProfile, Room, ShopItem } from "@/lib/types";
import { DIRT_LABELS, dirtLevel } from "./DirtOverlay";
import { IsoRoom, type PlacedFurniture } from "./IsoRoom";
import { FURNITURE_SPRITES } from "./sprites";
import { StatsModal } from "./StatsModal";

interface RoomViewProps {
  owner: PublicProfile;
  room: Room;
  shopItems: ShopItem[];
}

export function RoomView({ owner, room, shopItems }: RoomViewProps) {
  const { me } = useHotel();
  const router = useRouter();
  const isOwner = me.id === owner.id;
  const size = ROOM_SIZES[room.room_type] ?? ROOM_SIZES.kitnet;
  const geom = useMemo(() => roomGeometry(size.cols, size.rows), [size.cols, size.rows]);

  const [inventory, setInventory] = useState<FurniturePlacement[]>(room.inventory_json.furniture ?? []);
  useEffect(() => setInventory(room.inventory_json.furniture ?? []), [room.inventory_json.furniture]);

  const [statsOpen, setStatsOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const itemsById = useMemo(() => new Map(shopItems.map((i) => [i.id, i])), [shopItems]);

  const placed: PlacedFurniture[] = inventory
    .filter((f) => f.x !== null && f.y !== null)
    .map((f) => {
      const item = itemsById.get(f.item_id);
      return { uid: f.uid, asset: item?.asset_url ?? "", name: item?.name ?? "", x: f.x!, y: f.y! };
    })
    .filter((f) => FURNITURE_SPRITES[f.asset]);

  const stored = inventory.filter((f) => f.x === null || f.y === null);

  // ---- Escala responsiva
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(Math.min(1.6, entry.contentRect.width / geom.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [geom.width]);

  async function move(uid: string, x: number | null, y: number | null) {
    setError(null);
    const prev = inventory;
    setInventory((inv) => inv.map((f) => (f.uid === uid ? { ...f, x, y } : f)));
    const { error } = await createClient().rpc("move_furniture", { p_uid: uid, p_x: x, p_y: y });
    if (error) {
      setInventory(prev);
      setError(errorMessage(error));
    } else {
      router.refresh();
    }
  }

  const level = dirtLevel(room.cleanliness_score);

  return (
    <section className="pixel-panel overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b-2 border-line bg-panel2 px-4 py-2">
        <div>
          <h1 className="pixel-title">{isOwner ? "Meu quarto" : `Quarto de @${owner.nickname}`}</h1>
          <p className="text-xs text-cream/60">
            {size.label} · {isOwner ? "clique no piso para andar, no sofá para sentar" : "visitando"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-36">
            <div className="flex justify-between text-[10px] uppercase text-cream/70">
              <span>Limpeza</span>
              <span>{room.cleanliness_score}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-night">
              <div
                className={`h-full ${level === 0 ? "bg-mint" : level < 3 ? "bg-gold" : "bg-coral"}`}
                style={{ width: `${room.cleanliness_score}%` }}
              />
            </div>
            <div className="text-[10px] text-cream/60">{DIRT_LABELS[level]}</div>
          </div>
          {isOwner && (
            <button
              className={`pixel-btn ${editMode ? "pixel-btn-gold" : ""}`}
              onClick={() => {
                setEditMode((v) => !v);
                setSelected(null);
              }}
            >
              {editMode ? "✔ Pronto" : "🪑 Decorar"}
            </button>
          )}
        </div>
      </header>

      <div ref={wrapRef} className="relative w-full overflow-hidden bg-[#10141f]" style={{ height: geom.height * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: geom.width }}>
          <IsoRoom
            cols={size.cols}
            rows={size.rows}
            cleanliness={room.cleanliness_score}
            furniture={placed}
            player={{ nickname: me.nickname, config: me.avatar_config }}
            host={isOwner ? undefined : { nickname: owner.nickname, config: owner.avatar_config }}
            onTrophyClick={() => setStatsOpen(true)}
            editMode={editMode}
            selectedUid={selected}
            onEditFurnitureClick={(uid) => setSelected(uid === selected ? null : uid)}
            onEditTileClick={(x, y) => selected && move(selected, x, y).then(() => setSelected(null))}
          />
        </div>
        {level > 0 && !editMode && (
          <div className="absolute bottom-2 left-2 rounded bg-night/85 px-2 py-1 text-xs text-coral">
            🕷️ {isOwner ? "Quite suas dívidas vencidas para limpar o quarto." : `@${owner.nickname} está devendo…`}
          </div>
        )}
      </div>

      {editMode && (
        <footer className="space-y-2 border-t-2 border-line p-3">
          <p className="text-xs text-cream/70">
            Selecione um móvel (no quarto ou no inventário) e clique em um piso para posicioná-lo.
          </p>
          <div className="flex flex-wrap gap-2">
            {stored.length === 0 && <span className="text-sm text-cream/50">Inventário vazio. Compre móveis na Loja 🛍️</span>}
            {stored.map((f) => {
              const item = itemsById.get(f.item_id);
              return (
                <button
                  key={f.uid}
                  className={`pixel-btn ${selected === f.uid ? "pixel-btn-gold" : ""}`}
                  onClick={() => setSelected(selected === f.uid ? null : f.uid)}
                >
                  {item?.name ?? "Móvel"}
                </button>
              );
            })}
            {selected && placed.some((p) => p.uid === selected) && (
              <button className="pixel-btn pixel-btn-coral" onClick={() => move(selected, null, null).then(() => setSelected(null))}>
                Guardar no inventário
              </button>
            )}
          </div>
          {error && <p className="text-sm text-coral">{error}</p>}
        </footer>
      )}

      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} userId={owner.id} nickname={owner.nickname} />
    </section>
  );
}
