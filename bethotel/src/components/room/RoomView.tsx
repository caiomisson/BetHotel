"use client";

import { Footprints, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useHotel } from "@/components/hotel/HotelProvider";
import { ROOM_SIZES } from "@/lib/constants";
import { errorMessage } from "@/lib/format";
import { roomGeometry } from "@/lib/iso";
import { createClient } from "@/lib/supabase/client";
import type { FurniturePlacement, PublicProfile, Room, RoomDecor, ShopItem, WallTexture } from "@/lib/types";
import { AccountsPanel, VisitPanel } from "./SidePanels";
import { InventoryPanel } from "./InventoryPanel";
import { IsoRoom, tilesOf, type PlacedFurniture } from "./IsoRoom";
import { FURNITURE_SPRITES } from "./sprites";
import { StatsModal } from "./StatsModal";

interface RoomViewProps {
  owner: PublicProfile;
  room: Room;
  shopItems: ShopItem[];
  ownerWins: number;
}

const DEFAULT_DECOR: RoomDecor = { wall: "peeling", wallColor: "#d9cfb6", texture: "brick", light: "flicker" };
const MAX_ROOM_HEIGHT = 600;

export function RoomView({ owner, room, shopItems, ownerWins }: RoomViewProps) {
  const { me } = useHotel();
  const router = useRouter();
  const isOwner = me.id === owner.id;
  const size = ROOM_SIZES[room.room_type] ?? ROOM_SIZES.kitnet;
  const geom = useMemo(() => roomGeometry(size.cols, size.rows), [size.cols, size.rows]);

  const [inventory, setInventory] = useState<FurniturePlacement[]>(room.inventory_json.furniture ?? []);
  useEffect(() => setInventory(room.inventory_json.furniture ?? []), [room.inventory_json.furniture]);
  const [decor, setDecor] = useState<RoomDecor>({ ...DEFAULT_DECOR, ...room.decor });
  useEffect(() => setDecor({ ...DEFAULT_DECOR, ...room.decor }), [room.decor]);

  const [statsOpen, setStatsOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const itemsById = useMemo(() => new Map(shopItems.map((i) => [i.id, i])), [shopItems]);
  const placed: PlacedFurniture[] = inventory
    .filter((f) => f.x !== null && f.y !== null)
    .map((f) => {
      const item = itemsById.get(f.item_id);
      return { uid: f.uid, asset: item?.asset_url ?? "", name: item?.name ?? "", x: f.x!, y: f.y!, rot: (f.rot ?? 0) as 0 | 1 };
    })
    .filter((f) => FURNITURE_SPRITES[f.asset]);

  // ---- Escala: preenche a largura sem passar da altura máxima
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, scale: 1 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      const maxH = Math.min(MAX_ROOM_HEIGHT, window.innerWidth < 640 ? 420 : MAX_ROOM_HEIGHT);
      setBox({ w, scale: Math.min((w - 24) / geom.width, (maxH - 40) / geom.height, 2.6) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [geom.width, geom.height]);

  async function move(uid: string, x: number | null, y: number | null, rot: 0 | 1) {
    setError(null);
    const prev = inventory;
    setInventory((inv) => inv.map((f) => (f.uid === uid ? { ...f, x, y, rot } : f)));
    const { error } = await createClient().rpc("move_furniture", { p_uid: uid, p_x: x, p_y: y, p_rot: rot });
    if (error) {
      setInventory(prev);
      setError(errorMessage(error));
      return false;
    }
    router.refresh();
    return true;
  }

  async function applyWall(wall: "paint" | "texture", color: string, texture?: WallTexture) {
    setError(null);
    const prev = decor;
    setDecor({ ...decor, wall, wallColor: color, texture: texture ?? decor.texture });
    const { error } = await createClient().rpc("set_decor", { p_wall: wall, p_color: color, p_texture: texture ?? null });
    if (error) {
      setDecor(prev);
      setError(errorMessage(error));
    } else router.refresh();
  }

  const selectedRot = (inventory.find((f) => f.uid === selected)?.rot ?? 0) as 0 | 1;
  const selectedEntry = inventory.find((f) => f.uid === selected);
  const selectedLayer = selectedEntry ? FURNITURE_SPRITES[itemsById.get(selectedEntry.item_id)?.asset_url ?? ""]?.layer : undefined;

  /** Clique num móvel no modo decorar: com item de mesa selecionado, coloca em cima. */
  function onEditFurniture(uid: string) {
    const target = placed.find((p) => p.uid === uid);
    const tdef = target ? FURNITURE_SPRITES[target.asset] : undefined;
    if (selected && selectedLayer === "table" && target && tdef?.surface) {
      const tiles = tilesOf(target);
      const taken = new Set(
        placed.filter((p) => p.uid !== selected && FURNITURE_SPRITES[p.asset]?.layer === "table").map((p) => `${p.x},${p.y}`),
      );
      const spot = tiles.find((t) => !taken.has(`${t.x},${t.y}`)) ?? tiles[0];
      move(selected, spot.x, spot.y, 0).then((ok) => ok && setSelected(null));
      return;
    }
    setSelected(uid === selected ? null : uid);
  }

  const editHint =
    selectedLayer === "wall"
      ? "Clique num dos espaços tracejados da parede"
      : selectedLayer === "table"
        ? "Clique numa mesa (Mesa de Centro ou de Reunião)"
        : "Modo decorar: escolha um móvel e clique num piso";
  const precarious = decor.wall === "peeling" || decor.light === "flicker";
  const scaledH = geom.height * box.scale;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_330px]">
      <section className="pixel-panel flex min-w-0 flex-col overflow-hidden">
        <header className="panel-header justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate">
              Quarto {owner.room_number ?? "—"} · @{owner.nickname}
            </h1>
            <span className={`tag ${precarious ? "border-coral/70 text-coral" : "border-mint/70 text-mint"}`}>{precarious ? "Precário" : "Reformado"}</span>
            <span className="tag hidden border-line text-muted sm:inline-flex">{size.label}</span>
          </div>
          <button className="pixel-btn pixel-btn-ghost px-2.5 py-1 text-xs" onClick={() => setStatsOpen(true)}>
            <Trophy size={14} /> Carreira
          </button>
        </header>

        <div ref={wrapRef} className="pixel-grid-bg relative flex-1 overflow-hidden bg-[#121a2c]" style={{ minHeight: scaledH + 40 }}>
          <div
            className="absolute"
            style={{
              left: Math.max(0, (box.w - geom.width * box.scale) / 2),
              top: 12,
              width: geom.width,
              transform: `scale(${box.scale})`,
              transformOrigin: "top left",
            }}
          >
            <IsoRoom
              cols={size.cols}
              rows={size.rows}
              cleanliness={room.cleanliness_score}
              decor={decor}
              roomNumber={owner.room_number}
              trophies={ownerWins}
              furniture={placed}
              player={{ nickname: me.nickname, config: me.avatar_config }}
              host={isOwner ? undefined : { nickname: owner.nickname, config: owner.avatar_config }}
              onStatsClick={() => setStatsOpen(true)}
              editMode={editMode}
              selectedUid={selected}
              onEditFurnitureClick={onEditFurniture}
              wallSlots={editMode && selectedLayer === "wall"}
              onEditTileClick={(x, y) => selected && move(selected, x, y, selectedRot).then((ok) => ok && setSelected(null))}
            />
          </div>
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-md bg-night/85 px-2.5 py-1.5 text-xs text-cream/80">
            <Footprints size={13} className="text-gold" />
            {editMode ? editHint : "Clique no piso para andar · clique em assentos para sentar"}
          </div>
        </div>
      </section>

      <aside className="flex min-w-0 flex-col gap-4">
        {isOwner ? (
          <>
            <AccountsPanel />
            <InventoryPanel
              room={room}
              inventory={inventory}
              itemsById={itemsById}
              decor={decor}
              editMode={editMode}
              setEditMode={(v) => {
                setEditMode(v);
                setSelected(null);
                setError(null);
              }}
              selected={selected}
              setSelected={setSelected}
              selectedRot={selectedRot}
              placedCount={placed.length}
              onRotate={() => {
                const next = (selectedRot ? 0 : 1) as 0 | 1;
                const p = placed.find((f) => f.uid === selected);
                if (p) move(p.uid, p.x, p.y, next);
                else setInventory((inv) => inv.map((f) => (f.uid === selected ? { ...f, rot: next } : f)));
              }}
              onStore={() => {
                const p = placed.find((f) => f.uid === selected);
                if (p) move(p.uid, null, null, selectedRot).then(() => setSelected(null));
              }}
              isSelectedPlaced={placed.some((f) => f.uid === selected)}
              onWall={applyWall}
              error={error}
            />
          </>
        ) : (
          <VisitPanel owner={owner} cleanliness={room.cleanliness_score} wins={ownerWins} />
        )}
      </aside>

      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} userId={owner.id} nickname={owner.nickname} />
    </div>
  );
}
