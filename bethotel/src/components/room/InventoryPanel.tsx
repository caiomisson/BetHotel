"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Hammer, Lock, Package, RotateCw, Warehouse } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHotel } from "@/components/hotel/HotelProvider";
import { Coin } from "@/components/ui/Coin";
import { ROOM_SIZES, WALL_COLORS } from "@/lib/constants";
import { errorMessage } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { FurniturePlacement, Room, RoomDecor, ShopItem, WallTexture } from "@/lib/types";

interface InventoryPanelProps {
  room: Room;
  inventory: FurniturePlacement[];
  itemsById: Map<string, ShopItem>;
  decor: RoomDecor;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  selected: string | null;
  setSelected: (v: string | null) => void;
  selectedRot: 0 | 1;
  placedCount: number;
  isSelectedPlaced: boolean;
  onRotate: () => void;
  onStore: () => void;
  onWall: (wall: "paint" | "texture", color: string, texture?: WallTexture) => void;
  error: string | null;
}

/** Seção recolhível "Inventário / Móveis": decorar, parede e ampliar o quarto. */
export function InventoryPanel(p: InventoryPanelProps) {
  const { me } = useHotel();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upgrades = new Set(p.room.inventory_json.upgrades ?? []);
  const canPaint = upgrades.has("paint_simple") || upgrades.has("paint_texture");
  const canTexture = upgrades.has("paint_texture");
  const stored = p.inventory.filter((f) => (f.x === null || f.y === null) && p.itemsById.has(f.item_id));
  const currentSize = ROOM_SIZES[p.room.room_type]?.cols ?? 4;

  async function upgrade(type: "studio" | "loft") {
    setBusy(true);
    setUpgradeError(null);
    const { error } = await createClient().rpc("upgrade_room", { p_type: type });
    setBusy(false);
    if (error) setUpgradeError(errorMessage(error));
    else router.refresh();
  }

  return (
    <section className="pixel-panel overflow-hidden">
      <button className="panel-header w-full justify-between border-b-0" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="flex items-center gap-2">
          <Package size={16} className="text-gold" /> Inventário / Móveis
        </span>
        <span className="flex items-center gap-2 font-body text-xs text-muted">
          {p.placedCount} no quarto
          <ChevronDown size={16} className={`transition ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t-2 border-line">
            <div className="space-y-4 p-3">
              {/* Móveis */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-pixel text-sm">Móveis</h3>
                  <button className={`pixel-btn px-2.5 py-1 text-xs ${p.editMode ? "pixel-btn-gold" : ""}`} onClick={() => p.setEditMode(!p.editMode)}>
                    <Hammer size={13} /> {p.editMode ? "Pronto" : "Decorar"}
                  </button>
                </div>
                {p.editMode ? (
                  <>
                    <p className="text-xs text-muted">Clique num móvel do quarto ou do inventário e depois num piso.</p>
                    <div className="flex flex-wrap gap-1.5">
                      {stored.length === 0 && <span className="text-xs text-muted">Nada guardado.</span>}
                      {stored.map((f) => (
                        <button
                          key={f.uid}
                          className={`pixel-btn px-2 py-1 text-xs ${p.selected === f.uid ? "pixel-btn-gold" : ""}`}
                          onClick={() => p.setSelected(p.selected === f.uid ? null : f.uid)}
                        >
                          {p.itemsById.get(f.item_id)?.name ?? "Móvel"}
                        </button>
                      ))}
                    </div>
                    {p.selected && (
                      <div className="flex gap-2">
                        <button className="pixel-btn px-2 py-1 text-xs" onClick={p.onRotate}>
                          <RotateCw size={13} /> Girar
                        </button>
                        {p.isSelectedPlaced && (
                          <button className="pixel-btn pixel-btn-coral px-2 py-1 text-xs" onClick={p.onStore}>
                            Guardar
                          </button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted">
                    {stored.length} guardado{stored.length === 1 ? "" : "s"} no inventário. Use Decorar para posicionar.
                  </p>
                )}
              </div>

              {/* Parede */}
              <div className="space-y-2">
                <h3 className="font-pixel text-sm">Parede</h3>
                {!canPaint ? (
                  <p className="text-xs text-muted">Reboco descascado. Compre a Pintura Simples (5) na Loja → Reforma Inicial.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {WALL_COLORS.map((c) => (
                        <button
                          key={c}
                          aria-label={`Cor ${c}`}
                          className={`h-6 w-6 rounded border-2 ${p.decor.wallColor === c ? "border-gold" : "border-black/40"}`}
                          style={{ background: c }}
                          onClick={() => p.onWall(p.decor.wall === "texture" ? "texture" : "paint", c, p.decor.wall === "texture" ? p.decor.texture : undefined)}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button className={`pixel-btn px-2 py-1 text-xs ${p.decor.wall === "paint" ? "pixel-btn-gold" : ""}`} onClick={() => p.onWall("paint", p.decor.wallColor)}>
                        Lisa
                      </button>
                      {(["brick", "relief"] as WallTexture[]).map((t) => (
                        <button
                          key={t}
                          disabled={!canTexture}
                          className={`pixel-btn px-2 py-1 text-xs ${p.decor.wall === "texture" && p.decor.texture === t ? "pixel-btn-gold" : ""}`}
                          onClick={() => p.onWall("texture", p.decor.wallColor, t)}
                        >
                          {!canTexture && <Lock size={11} />}
                          {t === "brick" ? "Tijolinho" : "Relevo 3D"}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {p.decor.light === "flicker" && <p className="text-xs text-muted">A lâmpada velha ainda pisca. A Lâmpada de LED (10) resolve.</p>}
              </div>

              {/* Ampliar */}
              <div className="space-y-2">
                <h3 className="flex items-center gap-1.5 font-pixel text-sm">
                  <Warehouse size={14} /> Ampliar quarto
                </h3>
                {(["studio", "loft"] as const).map((type) => {
                  const info = ROOM_SIZES[type];
                  const owned = info.cols <= currentSize;
                  return (
                    <div key={type} className="flex items-center justify-between rounded-md border-2 border-line bg-deep/60 px-3 py-2 text-sm">
                      <span>{info.label}</span>
                      {owned ? (
                        <span className="text-xs text-mint">{info.cols === currentSize ? "Seu quarto" : "Incluso"}</span>
                      ) : (
                        <button
                          className="pixel-btn pixel-btn-gold px-2 py-1 text-xs"
                          disabled={busy || me.hotel_coins < info.price}
                          onClick={() => confirm(`Mudar para ${info.label} por ${info.price} moedas?`) && upgrade(type)}
                        >
                          <Coin size={12} /> {info.price}
                        </button>
                      )}
                    </div>
                  );
                })}
                {upgradeError && <p className="text-xs text-coral">{upgradeError}</p>}
              </div>
              {p.error && <p className="text-sm text-coral">{p.error}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
