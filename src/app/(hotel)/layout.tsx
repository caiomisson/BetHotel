import { redirect } from "next/navigation";
import { HotelProvider } from "@/components/hotel/HotelProvider";
import { PresenceProvider } from "@/components/hotel/PresenceProvider";
import { TopBar } from "@/components/hotel/TopBar";
import { createClient } from "@/lib/supabase/server";
import type { BetExpense, MyProfile, NickEntry, Room } from "@/lib/types";

export default async function HotelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profileRows }, { data: room }, { data: guests }, { data: bets }] = await Promise.all([
    supabase.rpc("get_my_profile"),
    supabase.from("rooms").select("*").eq("user_id", user.id).single(),
    supabase.from("profiles").select("id,nickname,full_name,avatar_config,room_number,bio").order("nickname").limit(1000),
    supabase.from("bets_expenses").select("*, bet_participants(*)").order("created_at", { ascending: false }).limit(200),
  ]);

  const me = (profileRows as MyProfile[] | null)?.[0];
  if (!me || !room) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="pixel-panel max-w-sm p-6">
          Seu perfil ainda não foi criado. Verifique se os scripts SQL do Supabase foram executados e faça login novamente.
        </p>
      </main>
    );
  }

  return (
    <HotelProvider me={me} myRoom={room as Room} guests={(guests ?? []) as NickEntry[]} bets={(bets ?? []) as BetExpense[]}>
      <PresenceProvider userId={me.id}>
        <TopBar />
        <main className="mx-auto w-full max-w-[1260px] px-3 pb-10 pt-5 sm:px-5">{children}</main>
      </PresenceProvider>
    </HotelProvider>
  );
}
