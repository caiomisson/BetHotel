"use client";

import { motion } from "framer-motion";
import { Bed, Building2, Coins, MessagesSquare, Receipt, Store, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/room/Avatar";
import { useHotel } from "./HotelProvider";

const NAV = [
  { href: "/", label: "Meu Quarto", icon: Bed },
  { href: "/loja", label: "Loja do Hotel", icon: Store },
  { href: "/diretorio", label: "Diretório de Hóspedes", icon: Users },
  { href: "/apostas", label: "Apostas & Despesas", icon: Receipt },
  { href: "/avisos", label: "Central de Avisos", icon: MessagesSquare },
];

export function TopBar() {
  const { me } = useHotel();
  const pathname = usePathname();
  const active = (href: string) => (href === "/" ? pathname === "/" || pathname.startsWith("/quarto") : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b-2 border-line bg-night/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1260px] flex-wrap items-center gap-3 px-3 py-2.5 sm:px-5 lg:flex-nowrap">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-md border-2 border-gold text-gold">
            <Building2 size={18} />
          </span>
          <span className="hidden font-pixel text-xl font-bold sm:inline">
            Bet<span className="text-gold">Hotel</span>
          </span>
        </Link>

        <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto px-1 lg:order-none lg:ml-4 lg:w-auto" aria-label="Principal">
          {NAV.map(({ href, label, icon: Icon }) => {
            const on = active(href);
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 font-pixel text-[13px] transition ${
                  on ? "text-night" : "text-muted hover:text-cream"
                }`}
              >
                {on && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded border-2 border-gold bg-gold"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <Icon size={15} className="relative" />
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md border-2 border-gold/70 px-2.5 py-1.5 text-gold" title="Hotel Coins">
            <Coins size={16} />
            <span className="font-pixel text-base font-bold">{me.hotel_coins}</span>
            <span className="hidden font-pixel text-[10px] uppercase sm:inline">coins</span>
          </div>
          <Link href="/perfil" className="flex items-center gap-2 rounded-md px-1 hover:bg-panel2" title="Perfil e avatar">
            <span className="grid h-10 w-10 place-items-end overflow-hidden rounded-md border-2 border-line bg-panel2">
              <span className="-mb-5 scale-75">
                <Avatar config={me.avatar_config} size={56} />
              </span>
            </span>
            <span className="hidden leading-tight md:block">
              <span className="block font-pixel text-sm">@{me.nickname}</span>
              <span className="block text-xs text-muted">Quarto {me.room_number ?? "—"}</span>
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
