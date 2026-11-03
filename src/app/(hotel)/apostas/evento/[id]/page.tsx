import { EventPage } from "@/components/bets/EventPage";

/** Os dados do evento já vêm do layout do hotel (HotelProvider). */
export default async function EventoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventPage eventId={id} />;
}
