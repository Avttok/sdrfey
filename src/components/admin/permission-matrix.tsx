"use client";

import { Check, LayoutDashboard, MousePointerClick, PanelsTopLeft, Search, X } from "lucide-react";
import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, panelCls } from "@/components/ui";
import { DOMAINS, domainOf, PERMISSIONS, type PermissionDomain, type PermissionMap } from "@/config/permissions";
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
  const [q, setQ] = useState("");
  const [dom, setDom] = useState<PermissionDomain | "all">("all");
  const { run, pending } = useRun();
  const dirty = JSON.stringify(roles) !== JSON.stringify(initialRoles) || users.some((u) => JSON.stringify(per[u.id]) !== JSON.stringify(u.perms));

  const roleOn = (r: RoleKey, key: string) => { const def = PERMISSIONS.find((p) => p.key === key)!; return key in roles[r] ? !!roles[r][key] : def.defaults.includes(r); };
  const inherited = (u: MatrixUser, key: string) => u.roles.some((r) => r !== "admin" && roleOn(r as RoleKey, key));
  const setOwn = (id: number, key: string, v: boolean | null) => { const n = { ...(per[id] ?? {}) }; if (v === null) delete n[key]; else n[key] = v; setPer({ ...per, [id]: n }); };
  /** No cargo, só aparece o que faz sentido para ele; na pessoa, tudo (ajuste individual). */
  const visible = (key: string) => { if (target.kind !== "role") return true; const d = domainOf(key); return target.role === "manager" || !((target.role === "seller" && d === "SDR") || (target.role === "user" && d === "Vendas")); };
  const matches = (p: { key: string; label: string }) => (!q.trim() || p.label.toLowerCase().includes(q.trim().toLowerCase())) && (dom === "all" || domainOf(p.key) === dom) && visible(p.key);
  const bulk = (group: string, v: boolean | null) => {
    const keys = PERMISSIONS.filter((p) => p.group === group && matches(p)).map((p) => p.key);
    if (target.kind === "role") { const r = target.role; const n = { ...roles[r] }; for (const k of keys) n[k] = v === null ? PERMISSIONS.find((p) => p.key === k)!.defaults.includes(r) : v; setRoles({ ...roles, [r]: n }); }
    else { const id = target.id; const n = { ...(per[id] ?? {}) }; for (const k of keys) { if (v === null) delete n[k]; else n[k] = v; } setPer({ ...per, [id]: n }); }
  };
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

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Categoria">
        {[{ key: "all" as const, label: "Todas", hint: "" }, ...DOMAINS].map((d) => {
          const n = PERMISSIONS.filter((p) => (d.key === "all" || domainOf(p.key) === d.key) && visible(p.key)).length;
          return <button key={d.key} type="button" role="tab" aria-selected={dom === d.key} title={d.hint} onClick={() => setDom(d.key)} className={`rounded-xl border-2 px-3.5 py-1.5 text-sm font-semibold transition ${dom === d.key ? "border-accent bg-accent/10" : "border-line bg-panel hover:bg-sunk"}`}>{d.label} <span className="figure ml-1 text-xs text-muted">{n}</span></button>;
        })}
      </div>
      <label className="relative block">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar uma permissão (ex.: Metas, Visitas, chat…)" aria-label="Buscar permissão" className="w-full rounded-xl border border-line bg-panel py-2.5 pl-9 pr-3 text-sm outline-none focus:border-accent" />
      </label>

      <section className={`${panelCls} overflow-hidden`}>
        {SECTIONS.map((sec) => (
          <div key={sec.group}>
            <header className="flex items-center gap-3 border-y border-line bg-sunk px-4 py-2.5 first:border-t-0">
              <sec.icon size={17} className="text-accent" aria-hidden />
              <h2 className="text-sm font-semibold">{sec.title}</h2><p className="hidden text-xs text-muted sm:block">{sec.hint}</p>
              <span className="ml-auto flex shrink-0 gap-1 text-[11px] font-semibold">
                <button type="button" onClick={() => bulk(sec.group, true)} className="rounded-md border border-line bg-panel px-2 py-1 hover:border-ok hover:text-ok">{target.kind === "role" ? "Ligar todas" : "Liberar todas"}</button>
                <button type="button" onClick={() => bulk(sec.group, false)} className="rounded-md border border-line bg-panel px-2 py-1 hover:border-danger hover:text-danger">{target.kind === "role" ? "Desligar todas" : "Bloquear todas"}</button>
                <button type="button" onClick={() => bulk(sec.group, null)} className="rounded-md border border-line bg-panel px-2 py-1 hover:border-accent hover:text-accent">{target.kind === "role" ? "Padrão do sistema" : "Voltar ao padrão do cargo"}</button>
              </span>
            </header>
            <ul className="divide-y divide-line/60">
              {PERMISSIONS.filter((p) => p.group === sec.group && (!q.trim() || p.label.toLowerCase().includes(q.trim().toLowerCase())) && (dom === "all" || domainOf(p.key) === dom) && visible(p.key)).map((p) => (
                <li key={p.key} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1"><span className={`mr-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${domainOf(p.key) === "SDR" ? "bg-sky-500/15 text-sky-600" : domainOf(p.key) === "Vendas" ? "bg-emerald-500/15 text-emerald-600" : domainOf(p.key) === "Gestão" ? "bg-amber-500/15 text-amber-600" : "bg-sunk text-muted"}`}>{domainOf(p.key)}</span>{p.label}</span>
                  {target.kind === "role" ? (
                    (() => { const r = target.role; const on = roleOn(r, p.key); return (<>
                      <span className={`w-20 shrink-0 text-right text-xs font-semibold ${on ? "text-ok" : "text-muted"}`}>{on ? "Ligado" : "Desligado"}</span>
                      <button type="button" role="switch" aria-checked={on} aria-label={`${p.label} para ${ROLE_LABEL[r]}`} onClick={() => setRoles({ ...roles, [r]: { ...roles[r], [p.key]: !on } })} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-ok" : "bg-line"}`}>
                        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-[1.375rem]" : "left-0.5"}`} />
                      </button></>
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
          </div>
        ))}
      </section>

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
