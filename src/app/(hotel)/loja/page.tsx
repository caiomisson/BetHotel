import { ShopPage } from "@/components/shop/ShopPage";
import { createClient } from "@/lib/supabase/server";
import type { ShopItem } from "@/lib/types";

export default async function LojaPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("shop_items").select("*").eq("for_sale", true).order("sort_order");
  return <ShopPage items={(data ?? []) as ShopItem[]} />;
}
