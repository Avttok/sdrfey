"use client";

import { Check, LayoutDashboard, MousePointerClick, PanelsTopLeft, X } from "lucide-react";
import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, panelCls } from "@/components/ui";
import { PERMISSIONS, type PermissionMap } from "@/config/permissions";
import type { Role } from "@/config/roles";
import { savePermissionMatrixAction } from "@/modules/admin/config";

export type MatrixUser = { id: number; name: string; roles: Role[]; perms: PermissionMap; hex: string };
type RoleKey = "user" | "seller" | "manager";
type Roles = Record<RoleKey, PermissionMap>;
export type Target = { kind: "role"; role: RoleKey } | { kind: "user"; id: number };

const SECTIONS = [
  { group: "Abas", title: "Abas do menu", hint: "Quais telas aparecem no topo", icon: PanelsTopLeft },
  { group: "Painel", title: "Blocos do Dashboard", hint: "O que aparece no Dashboard", icon: LayoutDashboard },
  { group: "Funções", title: "Funções", hint: "O que a pessoa pode fazer", icon: MousePointerClick },
] as const;
const ROLE_LABEL: Record<RoleKey, string> = { user: "SDR", seller: "Vendas", manager: "Gestor" };

/**
 * Escolha quem editar (cargo ou pessoa) e ajuste tudo numa lista só — sem rolagem lateral.
 * Cargo: liga/desliga. Pessoa: Padrão do cargo, Liberar ou Bloquear.
 */
export function PermissionMatrix({ users, roles: initialRoles, target: ext, onTarget }: { users: MatrixUser[]; roles: Roles; target?: Target; onTarget?: (t: Target) => void }) {
  const [roles, setRoles] = useState<Roles>(initialRoles);
  const [per, setPer] = useState<Record<number, PermissionMap>>(Object.fromEntries(users.map((u) => [u.id, u.perms])));
  const [own, setOwnTarget] = useState<Target>({ kind: "role", role: "user" });
  const target = ext ?? own;
  const setTarget = (t: Target) => { setOwnTarget(t); onTarget?.(t); };
  const { run, pending } = useRun();
  const dirty = JSON.stringify(roles) !== JSON.stringify(initialRoles) || users.some((u) => JSON.stringify(per[u.id]) !== JSON.stringify(u.perms));

  const roleOn = (r: RoleKey, key: string) => { const def = PERMISSIONS.find((p) => p.key === key)!; return key in roles[r] ? !!roles[r][key] : def.defaults.includes(r); };
  const inherited = (u: MatrixUser, key: string) => u.roles.some((r) => r !== "admin" && roleOn(r as RoleKey, key));
  const setOwn = (id: number, key: string, v: boolean | null) => { const n = { ...(per[id] ?? {}) }; if (v === null) delete n[key]; else n[key] = v; setPer({ ...per, [id]: n }); };
  const person = target.kind === "user" ? users.find((u) => u.id === target.id) ?? null : null;
  const overrides = (id: number) => Object.keys(per[id] ?? {}).length;

  const chip = (active: boolean) => `flex items-center gap-2 rounded-xl border-2 px-3.5 py-2 text-sm font-semibold transition ${active ? "border-accent bg-accent/10" : "border-line bg-panel hover:bg-sunk"}`;
  return (
    <div className="space-y-4 pb-20">
      {!ext && <section className={`${panelCls} space-y-3 p-4`} aria-label="Quem você quer ajustar">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Padrão dos cargos</p>
        <div className="flex flex-wrap gap-2">
          {(["user", "seller", "manager"] as const).map((r) => <button key={r} type="button" aria-pressed={target.kind === "role" && target.role === r} className={chip(target.kind === "role" && target.role === r)} onClick={() => setTarget({ kind: "role", role: r })}>{ROLE_LABEL[r]}</button>)}
        </div>
        <p className="pt-1 text-xs font-semibold uppercase tracking-wider text-muted">Ajustes só para uma pessoa</p>
        <div className="flex flex-wrap gap-2">
          {users.map((u) => {
            const on = target.kind === "user" && target.id === u.id;
            const n = overrides(u.id);
            return (
              <button key={u.id} type="button" aria-pressed={on} className={chip(on)} onClick={() => setTarget({ kind: "user", id: u.id })}>
                <span className="grid size-6 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: u.hex }}>{u.name.slice(0, 2).toUpperCase()}</span>
                {u.name.split(" ")[0]}
                {n > 0 && <span title={`${n} ajuste(s) próprio(s)`} className="figure rounded-full bg-accent px-1.5 text-[11px] text-on-accent">{n}</span>}
              </button>
            );
          })}
        </div>
      </section>}

      <p className="text-sm text-muted">
        {person ? <>Editando <b className="text-ink">{person.name}</b>. “Padrão” segue o cargo; “Liberar” e “Bloquear” valem só para esta pessoa. O Adm sempre vê tudo.</> : <>Editando o padrão do cargo <b className="text-ink">{ROLE_LABEL[(target as { role: RoleKey }).role]}</b>. Vale para todos com esse cargo, exceto quem tem ajuste próprio.</>}
      </p>

      <div className="grid gap-4 2xl:grid-cols-2">
        {SECTIONS.map((sec) => (
          <section key={sec.group} className={`${panelCls} overflow-hidden `}>
            <header className="flex items-center gap-3 border-b border-line bg-sunk/60 px-4 py-3">
              <sec.icon size={18} className="text-accent" aria-hidden />
              <div><h2 className="text-sm font-semibold">{sec.title}</h2><p className="text-xs text-muted">{sec.hint}</p></div>
            </header>
            <ul className="divide-y divide-line/60">
              {PERMISSIONS.filter((p) => p.group === sec.group).map((p) => (
                <li key={p.key} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">{p.label}</span>
                  {target.kind === "role" ? (
                    (() => { const r = target.role; const on = roleOn(r, p.key); return (
                      <button type="button" role="switch" aria-checked={on} aria-label={`${p.label} para ${ROLE_LABEL[r]}`} onClick={() => setRoles({ ...roles, [r]: { ...roles[r], [p.key]: !on } })} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-ok" : "bg-line"}`}>
                        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-[1.375rem]" : "left-0.5"}`} />
                      </button>
                    ); })()
                  ) : (
                    (() => { const u = person!; const own = per[u.id] ?? {}; const has = p.key in own; const state = has ? (own[p.key] ? "on" : "off") : "def"; const inh = inherited(u, p.key); return (
                      <div role="radiogroup" aria-label={`${p.label} para ${u.name}`} className="flex shrink-0 overflow-hidden rounded-lg border border-line text-xs font-medium">
                        <button type="button" role="radio" aria-checked={state === "def"} onClick={() => setOwn(u.id, p.key, null)} className={`px-2.5 py-1.5 transition ${state === "def" ? "bg-sunk text-ink" : "text-muted hover:bg-sunk/60"}`}>Padrão <span className={inh ? "text-ok" : "text-muted"}>({inh ? "sim" : "não"})</span></button>
                        <button type="button" role="radio" aria-checked={state === "on"} onClick={() => setOwn(u.id, p.key, true)} className={`flex items-center gap-1 border-l border-line px-2.5 py-1.5 transition ${state === "on" ? "bg-ok/20 text-ok" : "text-muted hover:bg-sunk/60"}`}><Check size={13} aria-hidden />Liberar</button>
                        <button type="button" role="radio" aria-checked={state === "off"} onClick={() => setOwn(u.id, p.key, false)} className={`flex items-center gap-1 border-l border-line px-2.5 py-1.5 transition ${state === "off" ? "bg-danger/20 text-danger" : "text-muted hover:bg-sunk/60"}`}><X size={13} aria-hidden />Bloquear</button>
                      </div>
                    ); })()
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {dirty && (
        <div role="status" className="fixed inset-x-0 bottom-5 z-30 mx-auto flex w-[min(34rem,calc(100%-2rem))] items-center gap-3 rounded-2xl border border-accent bg-panel p-3 pl-4 shadow-2xl">
          <span className="flex-1 text-sm font-medium">Alterações ainda não salvas</span>
          <button type="button" className={btnGhost} disabled={pending} onClick={() => { setRoles(initialRoles); setPer(Object.fromEntries(users.map((u) => [u.id, u.perms]))); }}>Descartar</button>
          <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => savePermissionMatrixAction({ roles, users: per }))}>Salvar</button>
        </div>
      )}
    </div>
  );
}
