import { Avatar } from "@/components/room/Avatar";
import { DEFAULT_AVATAR } from "@/lib/constants";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="animate-bob">
            <Avatar config={{ ...DEFAULT_AVATAR, shirtColor: "#ef6b5b", hat: "cap" }} pose="stand" size={64} />
          </div>
          <h1 className="font-pixel text-lg text-gold">BetHotel</h1>
          <p className="text-sm text-cream/70">Apostou, perdeu, pagou. Senão, teia de aranha no quarto.</p>
        </div>
        <div className="pixel-panel p-5">{children}</div>
      </div>
    </main>
  );
}
