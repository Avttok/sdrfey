"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { AvatarGlyph } from "@/components/avatar-glyph";
import { useRun } from "@/components/use-run";
import { AVATARS } from "@/config/avatars";
import { setAvatarAction } from "@/modules/users/actions";

/** Escolha do ícone de perfil (por enquanto não há upload de foto). */
export function AvatarPicker({ current, initials }: { current: string | null; initials: string }) {
  const [sel, setSel] = useState(current);
  const { run, pending } = useRun();
  const pick = (k: string | null) => { setSel(k); void run(() => setAvatarAction(k)); };
  const base = "grid size-12 place-items-center rounded-2xl border-2 transition";
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Ícone de perfil</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Ícone de perfil">
        <button type="button" role="radio" aria-checked={!sel} disabled={pending} title="Iniciais do nome" onClick={() => pick(null)} className={`${base} text-sm font-bold ${!sel ? "border-accent bg-grad text-on-accent" : "border-line bg-sunk text-muted hover:text-ink"}`}>{initials}</button>
        {AVATARS.map((a) => (
          <button key={a.key} type="button" role="radio" aria-checked={sel === a.key} disabled={pending} title={a.label} onClick={() => pick(a.key)} className={`${base} relative hover:-translate-y-0.5 ${sel === a.key ? "border-accent bg-grad text-on-accent shadow-md" : "border-line bg-sunk text-muted hover:text-ink"}`}>
            <AvatarGlyph avatar={a.key} initials="" size={22} />
            {sel === a.key && <Check size={11} aria-hidden className="absolute -right-1 -top-1 rounded-full bg-ok p-0.5 text-white" />}
          </button>
        ))}
      </div>
    </div>
  );
}
