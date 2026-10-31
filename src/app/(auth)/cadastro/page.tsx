"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/format";

const NICK_RE = /^[a-z0-9_]{3,20}$/;

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ full_name: "", nickname: "", email: "", password: "", pix_key: "", whatsapp: "" });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: k === "nickname" ? e.target.value.toLowerCase().replace(/^@/, "") : e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!NICK_RE.test(form.nickname)) return setError("O @nick deve ter 3 a 20 letras minúsculas, números ou _.");
    const phone = form.whatsapp.replace(/\D/g, "");
    if (phone && (phone.length < 10 || phone.length > 15)) return setError("WhatsApp inválido. Use DDD + número.");

    setLoading(true);
    const supabase = createClient();
    const { data: available } = await supabase.rpc("nickname_available", { p_nick: form.nickname });
    if (!available) {
      setLoading(false);
      return setError("Esse @nick já está em uso.");
    }

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/perfil`,
        data: { full_name: form.full_name, nickname: form.nickname, pix_key: form.pix_key, whatsapp: phone },
      },
    });
    setLoading(false);
    if (error) return setError(errorMessage(error));

    if (data.session) {
      router.replace("/perfil?boas-vindas=1");
      router.refresh();
    } else {
      setInfo("Quase lá! Confirme o cadastro pelo link que enviamos para o seu e-mail.");
    }
  }

  if (info) return <p className="text-center text-mint">{info}</p>;

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <h2 className="pixel-title">Cadastro de hóspede</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="pixel-label" htmlFor="full_name">Nome</label>
          <input id="full_name" required className="pixel-input" value={form.full_name} onChange={set("full_name")} />
        </div>
        <div>
          <label className="pixel-label" htmlFor="nickname">@nick</label>
          <input id="nickname" required className="pixel-input" placeholder="bernardo" value={form.nickname} onChange={set("nickname")} />
        </div>
      </div>
      <div>
        <label className="pixel-label" htmlFor="email">E-mail</label>
        <input id="email" type="email" required className="pixel-input" value={form.email} onChange={set("email")} />
      </div>
      <div>
        <label className="pixel-label" htmlFor="password">Senha</label>
        <input id="password" type="password" minLength={6} required className="pixel-input" value={form.password} onChange={set("password")} />
      </div>
      <div>
        <label className="pixel-label" htmlFor="pix">Chave Pix (para receber)</label>
        <input id="pix" className="pixel-input" placeholder="e-mail, celular, CPF ou aleatória" value={form.pix_key} onChange={set("pix_key")} />
      </div>
      <div>
        <label className="pixel-label" htmlFor="whatsapp">WhatsApp</label>
        <input id="whatsapp" inputMode="tel" className="pixel-input" placeholder="(31) 99999-0000" value={form.whatsapp} onChange={set("whatsapp")} />
      </div>
      <p className="text-xs text-cream/60">Pix e WhatsApp só aparecem para quem divide uma aposta ou conta com você.</p>
      {error && <p className="text-sm text-coral">{error}</p>}
      <button className="pixel-btn pixel-btn-gold w-full" disabled={loading}>
        {loading ? "Preparando sua Kitnet..." : "Pegar a chave do quarto"}
      </button>
      <p className="text-center text-sm text-cream/70">
        Já é hóspede? <Link href="/login" className="text-sky underline">Entrar</Link>
      </p>
    </form>
  );
}
