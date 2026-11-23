"use client";

import { Check, Lock } from "lucide-react";
import { useState } from "react";
import { AvatarGlyph } from "@/components/avatar-glyph";
import { useRun } from "@/components/use-run";
import { RarityTag, unlockHint } from "@/components/rarity-tag";
import { RARITIES, rarityOf } from "@/config/achievements";
import { AVATARS, avatarOpen } from "@/config/avatars";
import { setAvatarAction } from "@/modules/users/actions";

const RARITY_DOT = Object.fromEntries(RARITIES.map((r) => [r.key, r.color])) as Record<string, string>;

/** Escolha do ícone de perfil (por enquanto não há upload de foto). */
export function AvatarPicker({ current, initials, earned = [] }: { current: string | null; initials: string; earned?: readonly string[] }) {
  const [sel, setSel] = useState(current);
  const { run, pending } = useRun();
  const pick = (k: string | null) => { setSel(k); void run(() => setAvatarAction(k)); };
  const base = "grid size-12 place-items-center rounded-2xl border-2 transition";
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Ícone de perfil <span className="font-normal text-muted">· os com cadeado saem de conquistas</span></p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Ícone de perfil">
        <button type="button" role="radio" aria-checked={!sel} disabled={pending} title="Iniciais do nome" onClick={() => pick(null)} className={`${base} text-sm font-bold ${!sel ? "border-accent bg-grad text-on-accent" : "border-line bg-sunk text-muted hover:text-ink"}`}>{initials}</button>
        {AVATARS.map((a) => {
          const open = avatarOpen(a, earned);
          return (
            <button key={a.key} type="button" role="radio" aria-checked={sel === a.key} aria-disabled={!open} disabled={pending || !open} title={open ? (a.unlock ? `${a.label} · ${unlockHint(a.unlock).replace("Libera", "liberado")}` : a.label) : `${a.label} · ${unlockHint(a.unlock!)}`} onClick={() => pick(a.key)} className={`${base} relative ${open ? "hover:-translate-y-0.5" : "cursor-not-allowed opacity-50"} ${sel === a.key ? "border-accent bg-grad text-on-accent shadow-md" : "border-line bg-sunk text-muted hover:text-ink"}`}>
              <AvatarGlyph avatar={a.key} initials="" size={22} />
              {!open && <span className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full bg-panel text-muted ring-1 ring-line"><Lock size={9} aria-hidden /></span>}
              {a.unlock && <span aria-hidden className="absolute -left-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-panel" style={{ background: RARITY_DOT[rarityOf(a.unlock)] }} />}
              {sel === a.key && <Check size={11} aria-hidden className="absolute -right-1 -top-1 rounded-full bg-ok p-0.5 text-white" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
