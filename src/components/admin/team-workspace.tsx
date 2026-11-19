"use client";

import { KeyRound, Search, Shield, UserCog } from "lucide-react";
import { useMemo, useState } from "react";
import { NewUser } from "@/components/admin/new-user";
import { PermissionMatrix, type MatrixUser, type Target } from "@/components/admin/permission-matrix";
import { ProfileTriggerAll } from "@/components/admin/profile-trigger";
import { UserCard, type UserRow } from "@/components/admin/user-card";
import { panelCls, inputCls } from "@/components/ui";
import type { PermissionMap } from "@/config/permissions";

type RoleKey = "user" | "seller" | "manager";
const ROLES: { key: RoleKey; label: string; hint: string }[] = [
  { key: "user", label: "SDR", hint: "Prospecção" },
  { key: "seller", label: "Vendas", hint: "Negociações" },
  { key: "manager", label: "Gestão", hint: "Equipe e metas" },
];

/** Usuários + Permissões numa tela só: escolha um cargo (vale para todos) ou uma pessoa (ajustes individuais). */
export function TeamWorkspace({ people, matrixUsers, roles, myId }: { people: UserRow[]; matrixUsers: MatrixUser[]; roles: Record<RoleKey, PermissionMap>; myId: number }) {
  const [target, setTarget] = useState<Target>({ kind: "role", role: "user" });
  const [q, setQ] = useState("");
  const list = useMemo(() => { const t = q.trim().toLowerCase(); return t ? people.filter((u) => u.name.toLowerCase().includes(t) || u.username.toLowerCase().includes(t)) : people; }, [people, q]);
  const sel = target.kind === "user" ? people.find((u) => u.id === target.id) ?? null : null;
  const isAdminSel = !!sel?.roles.includes("admin");
  const item = (on: boolean) => `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${on ? "bg-grad text-on-accent shadow-sm" : "hover:bg-sunk"}`;

  return (
    <div className="grid gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <section className={`${panelCls} p-3`}>
          <p className="mb-1.5 flex items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-muted"><Shield size={13} aria-hidden /> Padrão por cargo (global)</p>
          {ROLES.map((r) => { const on = target.kind === "role" && target.role === r.key; return (
            <button key={r.key} type="button" aria-pressed={on} className={item(on)} onClick={() => setTarget({ kind: "role", role: r.key })}>
              <KeyRound size={16} aria-hidden /><span className="flex-1"><span className="block text-sm font-semibold">{r.label}</span><span className={`block text-xs ${on ? "opacity-80" : "text-muted"}`}>{r.hint}</span></span>
            </button>
          ); })}
        </section>
        <section className={`${panelCls} p-3`}>
          <p className="mb-1.5 flex items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-muted"><UserCog size={13} aria-hidden /> Pessoas ({people.length})</p>
          <label className="relative mb-2 block"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden /><input className={`${inputCls} pl-8`} placeholder="Buscar pessoa…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar pessoa" /></label>
          <ul className="no-sb max-h-[50vh] space-y-0.5 overflow-y-auto">
            {list.map((u) => { const on = target.kind === "user" && target.id === u.id; return (
              <li key={u.id}><button type="button" aria-pressed={on} className={item(on)} onClick={() => setTarget({ kind: "user", id: u.id })}>
                <span className="relative grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: u.hex }}>{u.name.slice(0, 2).toUpperCase()}<span className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 ${on ? "border-transparent" : "border-panel"} ${u.online ? "bg-ok" : "bg-muted/50"}`} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{u.name}{u.id === myId ? " (você)" : ""}</span><span className={`block truncate text-xs ${on ? "opacity-80" : "text-muted"}`}>@{u.username}{!u.active ? " · bloqueado" : ""}</span></span>
              </button></li>
            ); })}
            {list.length === 0 && <li className="px-2 py-3 text-sm text-muted">Ninguém encontrado.</li>}
          </ul>
        </section>
        <NewUser />
        <ProfileTriggerAll />
      </aside>

      <div className="min-w-0 space-y-4">
        {sel && <ul><UserCard key={sel.id} u={sel} isMe={sel.id === myId} /></ul>}
        {isAdminSel
          ? <p className={`${panelCls} p-4 text-sm text-muted`}>Administradores sempre veem e fazem tudo, por isso não há permissões para ajustar aqui.</p>
          : <PermissionMatrix users={matrixUsers} roles={roles} target={target} onTarget={setTarget} />}
      </div>
    </div>
  );
}
