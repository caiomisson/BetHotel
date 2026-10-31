"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useHotel } from "@/components/hotel/HotelProvider";
import { errorMessage } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { AvatarConfig, ShopItem } from "@/lib/types";
import { AvatarEditor } from "./AvatarEditor";

export function ProfileForm({ clothing, welcome }: { clothing: ShopItem[]; welcome: boolean }) {
  const { me, myRoom } = useHotel();
  const router = useRouter();
  const [avatar, setAvatar] = useState<AvatarConfig>(me.avatar_config);
  const [form, setForm] = useState({
    full_name: me.full_name,
    nickname: me.nickname,
    pix_key: me.pix_key ?? "",
    whatsapp: me.whatsapp ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const ownedStyles = useMemo(() => {
    const ids = new Set(myRoom.inventory_json.wardrobe ?? []);
    return new Set(clothing.filter((c) => ids.has(c.id)).map((c) => c.asset_url));
  }, [clothing, myRoom.inventory_json.wardrobe]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const { error } = await createClient()
      .from("profiles")
      .update({
        full_name: form.full_name.trim(),
        nickname: form.nickname.trim().toLowerCase().replace(/^@/, ""),
        pix_key: form.pix_key.trim() || null,
        whatsapp: form.whatsapp.replace(/\D/g, "") || null,
        avatar_config: avatar,
      })
      .eq("id", me.id);
    setSaving(false);
    if (error) return setMsg({ text: errorMessage(error), ok: false });
    setMsg({ text: "Perfil salvo!", ok: true });
    router.refresh();
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form onSubmit={save} className="pixel-panel space-y-5 p-4">
      {welcome && (
        <div className="rounded border-2 border-gold/60 bg-gold/10 p-3 text-sm">
          🛎️ Bem-vindo(a) ao BetHotel! Sua Kitnet está pronta. Monte seu visual e confira seus dados de recebimento.
        </div>
      )}
      <section>
        <h2 className="pixel-title mb-3">Visual do avatar</h2>
        <AvatarEditor value={avatar} onChange={setAvatar} ownedStyles={ownedStyles} />
      </section>
      <section className="grid gap-3 sm:grid-cols-2">
        <h2 className="pixel-title sm:col-span-2">Dados do hóspede</h2>
        <div>
          <label className="pixel-label" htmlFor="pf-name">Nome</label>
          <input id="pf-name" className="pixel-input" required value={form.full_name} onChange={set("full_name")} />
        </div>
        <div>
          <label className="pixel-label" htmlFor="pf-nick">@nick</label>
          <input id="pf-nick" className="pixel-input" required pattern="@?[a-z0-9_]{3,20}" value={form.nickname} onChange={set("nickname")} />
        </div>
        <div>
          <label className="pixel-label" htmlFor="pf-pix">Chave Pix</label>
          <input id="pf-pix" className="pixel-input" value={form.pix_key} onChange={set("pix_key")} />
        </div>
        <div>
          <label className="pixel-label" htmlFor="pf-wa">WhatsApp</label>
          <input id="pf-wa" className="pixel-input" inputMode="tel" value={form.whatsapp} onChange={set("whatsapp")} />
        </div>
        <p className="text-xs text-cream/60 sm:col-span-2">
          Pix e WhatsApp ficam visíveis apenas para quem divide uma aposta ou conta com você.
        </p>
      </section>
      {msg && <p className={`text-sm ${msg.ok ? "text-mint" : "text-coral"}`}>{msg.text}</p>}
      <button className="pixel-btn pixel-btn-gold" disabled={saving}>
        {saving ? "Salvando…" : "Salvar perfil"}
      </button>
    </form>
  );
}
