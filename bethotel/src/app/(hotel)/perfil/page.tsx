import { ProfileForm } from "@/components/profile/ProfileForm";
import { createClient } from "@/lib/supabase/server";
import type { ShopItem } from "@/lib/types";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("shop_items").select("*").eq("category", "clothing");
  return <ProfileForm clothing={(data ?? []) as ShopItem[]} welcome={params["boas-vindas"] === "1"} />;
}
