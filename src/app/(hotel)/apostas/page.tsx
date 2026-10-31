import { BetsBoard } from "@/components/bets/BetsBoard";
import { createClient } from "@/lib/supabase/server";
import type { BetExpense } from "@/lib/types";

export default async function BetsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bets_expenses")
    .select("*, bet_participants(*)")
    .order("created_at", { ascending: false })
    .limit(100);

  return <BetsBoard bets={(data ?? []) as BetExpense[]} />;
}
