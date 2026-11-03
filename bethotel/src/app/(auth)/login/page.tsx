"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/format";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : errorMessage(error));
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h2 className="pixel-title">Check-in</h2>
      <div>
        <label className="pixel-label" htmlFor="email">E-mail</label>
        <input id="email" type="email" required className="pixel-input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="pixel-label" htmlFor="password">Senha</label>
        <input id="password" type="password" required className="pixel-input" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="text-sm text-coral">{error}</p>}
      <button className="pixel-btn pixel-btn-gold w-full" disabled={loading}>
        {loading ? "Entrando..." : "Entrar no hotel"}
      </button>
      <p className="text-center text-sm text-cream/70">
        Primeira vez? <Link href="/cadastro" className="text-sky underline">Faça seu cadastro</Link>
      </p>
    </form>
  );
}
