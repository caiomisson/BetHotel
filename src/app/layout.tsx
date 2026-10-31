import type { Metadata, Viewport } from "next";
import "@fontsource/press-start-2p/400.css";
import "@fontsource/pixelify-sans/400.css";
import "@fontsource/pixelify-sans/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "BetHotel",
  description: "Apostas entre amigos e divisão de contas num hotel pixelado. Pague em dia ou ganhe teias de aranha.",
};

export const viewport: Viewport = {
  themeColor: "#141a2a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
