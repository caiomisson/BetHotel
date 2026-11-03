import { DirectoryList, type DirectoryEntry } from "@/components/hotel/DirectoryList";
import { createClient } from "@/lib/supabase/server";
import type { RankingEntry } from "@/lib/types";

export default async function DirectoryPage() {
  const supabase = await createClient();
  const [{ data }, { data: ranking }] = await Promise.all([
    supabase.from("rooms").select("cleanliness_score, user_id").limit(1000),
    supabase.rpc("get_ranking", { p_limit: 100 }),
  ]);

  const entries = ((data ?? []) as DirectoryEntry[]).map((r) => r);
  return <DirectoryList rooms={entries} ranking={(ranking ?? []) as RankingEntry[]} />;
}
