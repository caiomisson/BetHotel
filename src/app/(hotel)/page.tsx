import { RoomView } from "@/components/room/RoomView";
import { createClient } from "@/lib/supabase/server";
import { PUBLIC_PROFILE_COLUMNS, type PublicProfile, type Room, type ShopItem } from "@/lib/types";

export default async function MyRoomPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: owner }, { data: room }, { data: items }] = await Promise.all([
    supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).eq("id", user!.id).single(),
    supabase.from("rooms").select("*").eq("user_id", user!.id).single(),
    supabase.from("shop_items").select("*"),
  ]);

  if (!owner || !room) return null;
  return <RoomView owner={owner as unknown as PublicProfile} room={room as Room} shopItems={(items ?? []) as ShopItem[]} />;
}
