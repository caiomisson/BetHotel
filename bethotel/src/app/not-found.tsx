import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="font-pixel text-sm text-gold">404 · Quarto não encontrado</p>
      <p className="text-cream/70">Esse hóspede não existe ou fez check-out.</p>
      <Link href="/" className="pixel-btn pixel-btn-gold">Voltar ao meu quarto</Link>
    </main>
  );
}
