"use client";

import { createContext, useContext, useMemo } from "react";
import { buildLedger, type Ledger } from "@/lib/ledger";
import type { BetExpense, MyProfile, NickEntry, Room } from "@/lib/types";

interface HotelContextValue {
  me: MyProfile;
  myRoom: Room;
  guests: NickEntry[];
  guestById: Map<string, NickEntry>;
  nickById: Map<string, string>;
  /** Apostas e despesas em que participo (RLS já filtra). */
  bets: BetExpense[];
  ledger: Ledger;
}

const HotelContext = createContext<HotelContextValue | null>(null);

export function HotelProvider({
  me,
  myRoom,
  guests,
  bets,
  children,
}: Pick<HotelContextValue, "me" | "myRoom" | "guests" | "bets"> & { children: React.ReactNode }) {
  const value = useMemo(
    () => ({
      me,
      myRoom,
      guests,
      bets,
      guestById: new Map(guests.map((g) => [g.id, g])),
      nickById: new Map(guests.map((g) => [g.id, g.nickname])),
      ledger: buildLedger(bets, me.id),
    }),
    [me, myRoom, guests, bets],
  );
  return <HotelContext.Provider value={value}>{children}</HotelContext.Provider>;
}

export function useHotel(): HotelContextValue {
  const ctx = useContext(HotelContext);
  if (!ctx) throw new Error("useHotel precisa estar dentro de <HotelProvider>");
  return ctx;
}
