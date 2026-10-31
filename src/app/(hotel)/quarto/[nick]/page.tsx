import { notFound } from "next/navigation";
import { RoomView } from "@/components/room/RoomView";
import { createClient } from "@/lib/supabase/server";
import { PUBLIC_PROFILE_COLUMNS, type PublicProfile, type Room, type ShopItem } from "@/lib/types";

export default async function VisitRoomPage({ params }: { params: Promise<{ nick: string }> }) {
  const { nick } = await params;
  const supabase = await createClient();

  const { data: owner } = await supabase
    .from("profiles")
    .select(PUBLIC_PROFILE_COLUMNS)
    .eq("nickname", decodeURIComponent(nick).toLowerCase())
    .maybeSingle();
  if (!owner) notFound();

  const profile = owner as unknown as PublicProfile;
  const [{ data: room }, { data: items }] = await Promise.all([
    supabase.from("rooms").select("*").eq("user_id", profile.id).single(),
    supabase.from("shop_items").select("*"),
  ]);
  if (!room) notFound();

  return <RoomView owner={profile} room={room as Room} shopItems={(items ?? []) as ShopItem[]} />;
}
