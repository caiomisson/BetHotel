import { redirect } from "next/navigation";
import { HotelProvider } from "@/components/hotel/HotelProvider";
import { TopBar } from "@/components/hotel/TopBar";
import { LobbyPanel } from "@/components/lobby/LobbyPanel";
import { createClient } from "@/lib/supabase/server";
import type { MyProfile, NickEntry, Room } from "@/lib/types";

export default async function HotelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profileRows }, { data: room }, { data: guests }] = await Promise.all([
    supabase.rpc("get_my_profile"),
    supabase.from("rooms").select("*").eq("user_id", user.id).single(),
    supabase.from("profiles").select("id,nickname,full_name").order("nickname").limit(1000),
  ]);

  const me = (profileRows as MyProfile[] | null)?.[0];
  if (!me || !room) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="pixel-panel max-w-sm p-6">
          Seu perfil ainda não foi criado. Verifique se o script SQL do Supabase foi executado e faça login novamente.
        </p>
      </main>
    );
  }

  return (
    <HotelProvider me={me} myRoom={room as Room} guests={(guests ?? []) as NickEntry[]}>
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 p-3 sm:p-4">
        <TopBar />
        <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_360px]">
          <main className="min-w-0">{children}</main>
          <LobbyPanel />
        </div>
      </div>
    </HotelProvider>
  );
}
