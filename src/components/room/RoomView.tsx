"use client";

import {
  Footprints,
  MessageSquare,
  SendHorizontal,
  Trophy,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRoomPresence } from "./useRoomPresence";
import { useHotel } from "@/components/hotel/HotelProvider";
import { ROOM_SIZES } from "@/lib/constants";
import { errorMessage } from "@/lib/format";
import { roomGeometry } from "@/lib/iso";
import { createClient } from "@/lib/supabase/client";
import type {
  FurniturePlacement,
  PublicProfile,
  Room,
  RoomDecor,
  ShopItem,
  WallTexture,
} from "@/lib/types";
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

const DEFAULT_DECOR: RoomDecor = {
  wall: "peeling",
  wallColor: "#d9cfb6",
  texture: "brick",
  light: "flicker",
};
const MAX_ROOM_HEIGHT = 600;

/** Cores do balão de fala (humor/status). */
const BUBBLE_COLORS = [
  { c: "#ffffff", label: "Normal" },
  { c: "#fde68a", label: "Animado" },
  { c: "#bbf7d0", label: "De boa" },
  { c: "#bae6fd", label: "Tranquilo" },
  { c: "#fbcfe8", label: "Apaixonado" },
  { c: "#fca5a5", label: "Bravo" },
];

export function RoomView({ owner, room, shopItems, ownerWins }: RoomViewProps) {
  const { me } = useHotel();
  const presence = useRoomPresence(owner.id, {
    id: me.id,
    nickname: me.nickname,
    config: me.avatar_config,
  });
  const [talk, setTalk] = useState("");
  const [bubbleColor, setBubbleColor] = useState(BUBBLE_COLORS[0].c);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("bh-bubble-color");
      if (saved && BUBBLE_COLORS.some((b) => b.c === saved))
        setBubbleColor(saved);
    } catch {}
  }, []);
  function chooseBubble(c: string) {
    setBubbleColor(c);
    try {
      localStorage.setItem("bh-bubble-color", c);
    } catch {}
  }
  function sendTalk(e: React.FormEvent) {
    e.preventDefault();
    presence.say(talk, bubbleColor);
    setTalk("");
  }
  const router = useRouter();
  const isOwner = me.id === owner.id;
  const size = ROOM_SIZES[room.room_type] ?? ROOM_SIZES.kitnet;
  const geom = useMemo(
    () => roomGeometry(size.cols, size.rows),
    [size.cols, size.rows],
  );

  const [inventory, setInventory] = useState<FurniturePlacement[]>(
    room.inventory_json.furniture ?? [],
  );
  useEffect(
    () => setInventory(room.inventory_json.furniture ?? []),
    [room.inventory_json.furniture],
  );
  const [decor, setDecor] = useState<RoomDecor>({
    ...DEFAULT_DECOR,
    ...room.decor,
  });
  useEffect(() => setDecor({ ...DEFAULT_DECOR, ...room.decor }), [room.decor]);

  const [statsOpen, setStatsOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const itemsById = useMemo(
    () => new Map(shopItems.map((i) => [i.id, i])),
    [shopItems],
  );
  const placed: PlacedFurniture[] = inventory
    .filter((f) => f.x !== null && f.y !== null)
    .map((f) => {
      const item = itemsById.get(f.item_id);
      return {
        uid: f.uid,
        asset: item?.asset_url ?? "",
        name: item?.name ?? "",
        x: f.x!,
        y: f.y!,
        rot: (f.rot ?? 0) as 0 | 1,
      };
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
      const maxH = Math.min(
        MAX_ROOM_HEIGHT,
        window.innerWidth < 640 ? 420 : MAX_ROOM_HEIGHT,
      );
      setBox({
        w,
        scale: Math.min((w - 24) / geom.width, (maxH - 40) / geom.height, 2.6),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [geom.width, geom.height]);

  async function move(
    uid: string,
    x: number | null,
    y: number | null,
    rot: 0 | 1,
  ) {
    setError(null);
    const prev = inventory;
    setInventory((inv) =>
      inv.map((f) => (f.uid === uid ? { ...f, x, y, rot } : f)),
    );
    const { error } = await createClient().rpc("move_furniture", {
      p_uid: uid,
      p_x: x,
      p_y: y,
      p_rot: rot,
    });
    if (error) {
      setInventory(prev);
      setError(errorMessage(error));
      return false;
    }
    router.refresh();
    return true;
  }

  async function applyWall(
    wall: "paint" | "texture",
    color: string,
    texture?: WallTexture,
  ) {
    setError(null);
    const prev = decor;
    setDecor({
      ...decor,
      wall,
      wallColor: color,
      texture: texture ?? decor.texture,
    });
    const { error } = await createClient().rpc("set_decor", {
      p_wall: wall,
      p_color: color,
      p_texture: texture ?? null,
    });
    if (error) {
      setDecor(prev);
      setError(errorMessage(error));
    } else router.refresh();
  }

  const selectedRot = (inventory.find((f) => f.uid === selected)?.rot ?? 0) as
    0 | 1;
  const selectedEntry = inventory.find((f) => f.uid === selected);
  const selectedLayer = selectedEntry
    ? FURNITURE_SPRITES[itemsById.get(selectedEntry.item_id)?.asset_url ?? ""]
        ?.layer
    : undefined;

  /** Clique num móvel no modo decorar: com item de mesa selecionado, coloca em cima. */
  function onEditFurniture(uid: string) {
    const target = placed.find((p) => p.uid === uid);
    const tdef = target ? FURNITURE_SPRITES[target.asset] : undefined;
    if (selected && selectedLayer === "table" && target && tdef?.surface) {
      const tiles = tilesOf(target);
      const taken = new Set(
        placed
          .filter(
            (p) =>
              p.uid !== selected &&
              FURNITURE_SPRITES[p.asset]?.layer === "table",
          )
          .map((p) => `${p.x},${p.y}`),
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
            <span
              className={`tag ${precarious ? "border-coral/70 text-coral" : "border-mint/70 text-mint"}`}
            >
              {precarious ? "Precário" : "Reformado"}
            </span>
            <span className="tag hidden border-line text-muted sm:inline-flex">
              {size.label}
            </span>
          </div>
          <button
            className="pixel-btn pixel-btn-ghost px-2.5 py-1 text-xs"
            onClick={() => setStatsOpen(true)}
          >
            <Trophy size={14} /> Carreira
          </button>
        </header>

        <div
          ref={wrapRef}
          className="pixel-grid-bg relative flex-1 overflow-hidden bg-[#121a2c]"
          style={{ minHeight: scaledH + 40 }}
        >
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
              playerId={me.id}
              others={presence.others}
              bubbles={presence.bubbles}
              onPlayerState={presence.publish}
              onStatsClick={() => setStatsOpen(true)}
              editMode={editMode}
              selectedUid={selected}
              onEditFurnitureClick={onEditFurniture}
              wallSlots={editMode && selectedLayer === "wall"}
              onEditTileClick={(x, y) =>
                selected &&
                move(selected, x, y, selectedRot).then(
                  (ok) => ok && setSelected(null),
                )
              }
            />
          </div>
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-md bg-night/85 px-2.5 py-1.5 text-xs text-cream/80">
            <Footprints size={13} className="text-gold" />
            {editMode
              ? editHint
              : "Clique no piso para andar · clique em assentos para sentar"}
          </div>
          <div
            className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md bg-night/85 px-2.5 py-1.5 text-xs text-cream/80"
            title="Hóspedes neste quarto agora"
          >
            <Users size={13} className="text-gold" />{" "}
            {presence.others.length + 1} no quarto
          </div>
        </div>
        <form
          onSubmit={sendTalk}
          className="flex flex-wrap items-center gap-2 border-t-2 border-line bg-panel2/50 p-2.5"
        >
          <MessageSquare size={16} className="shrink-0 text-gold" />
          <input
            className="pixel-input min-w-[160px] flex-1 py-1.5"
            maxLength={120}
            placeholder="Falar no quarto… (aparece no balão sobre seu avatar)"
            value={talk}
            onChange={(e) => setTalk(e.target.value)}
          />
          <div
            className="flex gap-1"
            role="radiogroup"
            aria-label="Cor do balão"
          >
            {BUBBLE_COLORS.map((b) => (
              <button
                key={b.c}
                type="button"
                role="radio"
                aria-checked={bubbleColor === b.c}
                title={b.label}
                onClick={() => chooseBubble(b.c)}
                className={`h-6 w-6 rounded border-2 ${bubbleColor === b.c ? "border-gold" : "border-black/50"}`}
                style={{ background: b.c }}
              />
            ))}
          </div>
          <button
            className="pixel-btn pixel-btn-gold h-8 w-9 p-0"
            disabled={!talk.trim()}
            aria-label="Falar"
          >
            <SendHorizontal size={15} />
          </button>
        </form>
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
                else
                  setInventory((inv) =>
                    inv.map((f) =>
                      f.uid === selected ? { ...f, rot: next } : f,
                    ),
                  );
              }}
              onStore={() => {
                const p = placed.find((f) => f.uid === selected);
                if (p)
                  move(p.uid, null, null, selectedRot).then(() =>
                    setSelected(null),
                  );
              }}
              isSelectedPlaced={placed.some((f) => f.uid === selected)}
              onWall={applyWall}
              error={error}
            />
          </>
        ) : (
          <VisitPanel
            owner={owner}
            cleanliness={room.cleanliness_score}
            wins={ownerWins}
          />
        )}
      </aside>

      <StatsModal
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        userId={owner.id}
        nickname={owner.nickname}
      />
    </div>
  );
}
