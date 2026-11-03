"use client";

import { createContext, useContext, useMemo } from "react";
import { buildLedger, type Ledger } from "@/lib/ledger";
import type { Bet, Debt, HotelEvent, MyProfile, NickEntry, Room } from "@/lib/types";

interface HotelContextValue {
  me: MyProfile;
  myRoom: Room;
  guests: NickEntry[];
  guestById: Map<string, NickEntry>;
  nickById: Map<string, string>;
  /** Apostas, eventos e cobranças em que participo (RLS já filtra). */
  bets: Bet[];
  events: HotelEvent[];
  debts: Debt[];
  ledger: Ledger;
}

const HotelContext = createContext<HotelContextValue | null>(null);

export function HotelProvider({
  me,
  myRoom,
  guests,
  bets,
  events,
  debts,
  children,
}: Pick<HotelContextValue, "me" | "myRoom" | "guests" | "bets" | "events" | "debts"> & { children: React.ReactNode }) {
  const value = useMemo(
    () => ({
      me,
      myRoom,
      guests,
      bets,
      events,
      debts,
      guestById: new Map(guests.map((g) => [g.id, g])),
      nickById: new Map(guests.map((g) => [g.id, g.nickname])),
      ledger: buildLedger(debts, bets, events, me.id),
    }),
    [me, myRoom, guests, bets, events, debts],
  );
  return <HotelContext.Provider value={value}>{children}</HotelContext.Provider>;
}

export function useHotel(): HotelContextValue {
  const ctx = useContext(HotelContext);
  if (!ctx) throw new Error("useHotel precisa estar dentro de <HotelProvider>");
  return ctx;
}
