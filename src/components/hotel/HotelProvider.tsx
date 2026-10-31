"use client";

import { createContext, useContext, useMemo } from "react";
import type { MyProfile, NickEntry, Room } from "@/lib/types";

interface HotelContextValue {
  me: MyProfile;
  myRoom: Room;
  guests: NickEntry[];
  nickById: Map<string, string>;
}

const HotelContext = createContext<HotelContextValue | null>(null);

export function HotelProvider({
  me,
  myRoom,
  guests,
  children,
}: Omit<HotelContextValue, "nickById"> & { children: React.ReactNode }) {
  const value = useMemo(
    () => ({ me, myRoom, guests, nickById: new Map(guests.map((g) => [g.id, g.nickname])) }),
    [me, myRoom, guests],
  );
  return <HotelContext.Provider value={value}>{children}</HotelContext.Provider>;
}

export function useHotel(): HotelContextValue {
  const ctx = useContext(HotelContext);
  if (!ctx) throw new Error("useHotel precisa estar dentro de <HotelProvider>");
  return ctx;
}
