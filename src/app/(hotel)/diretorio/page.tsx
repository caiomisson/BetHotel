import { DirectoryList, type DirectoryEntry } from "@/components/hotel/DirectoryList";
import { createClient } from "@/lib/supabase/server";

export default async function DirectoryPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rooms")
    .select("cleanliness_score, profiles!inner(id, nickname, full_name, avatar_config)")
    .limit(500);

  const entries = ((data ?? []) as unknown as DirectoryEntry[]).sort((a, b) =>
    a.profiles.nickname.localeCompare(b.profiles.nickname),
  );

  return <DirectoryList entries={entries} />;
}
