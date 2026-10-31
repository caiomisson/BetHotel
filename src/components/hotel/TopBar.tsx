"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { CreateBetModal } from "@/components/bets/CreateBetModal";
import { ShopModal } from "@/components/shop/ShopModal";
import { CoinAmount } from "@/components/ui/Coin";
import { createClient } from "@/lib/supabase/client";
import { useHotel } from "./HotelProvider";

const NAV = [
  { href: "/", label: "Meu Quarto" },
  { href: "/apostas", label: "Apostas" },
  { href: "/diretorio", label: "Diretório" },
  { href: "/perfil", label: "Perfil" },
];

export function TopBar() {
  const { me } = useHotel();
  const pathname = usePathname();
  const router = useRouter();
  const [betOpen, setBetOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <header className="pixel-panel flex flex-wrap items-center gap-3 px-3 py-2">
        <Link href="/" className="font-pixel text-xs text-gold sm:text-sm">
          🏨 BetHotel
        </Link>
        <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`whitespace-nowrap rounded px-3 py-1.5 text-sm ${
                pathname === n.href ? "bg-panel2 text-gold" : "text-cream/80 hover:bg-panel2"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <CoinAmount value={me.hotel_coins} className="rounded bg-night/60 px-2 py-1.5" />
          <button className="pixel-btn pixel-btn-gold" onClick={() => setBetOpen(true)}>
            🎲 <span className="hidden sm:inline">Nova aposta</span>
          </button>
          <button className="pixel-btn pixel-btn-mint" onClick={() => setShopOpen(true)}>
            🛍️ <span className="hidden sm:inline">Loja</span>
          </button>
          <button className="pixel-btn" onClick={logout} aria-label="Sair">
            ⎋
          </button>
        </div>
      </header>
      <CreateBetModal open={betOpen} onClose={() => setBetOpen(false)} />
      <ShopModal open={shopOpen} onClose={() => setShopOpen(false)} />
    </>
  );
}
