"use client";

import { Check, Minus, X } from "lucide-react";
import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, panelCls } from "@/components/ui";
import { PERMISSIONS, type PermissionMap } from "@/config/permissions";
import type { Role } from "@/config/roles";
import { savePermissionMatrixAction } from "@/modules/admin/config";

export type MatrixUser = { id: number; name: string; roles: Role[]; perms: PermissionMap; hex: string };
type RoleKey = "user" | "manager";
type Roles = Record<RoleKey, PermissionMap>;

const SECTIONS = [
  { group: "Abas", title: "Abas do menu", hint: "Quais telas aparecem no topo" },
  { group: "Painel", title: "Blocos do Dashboard", hint: "O que cada pessoa vê no Dashboard" },
  { group: "Funções", title: "Funções", hint: "O que cada pessoa pode fazer" },
] as const;

/**
 * Uma grade só para tudo: colunas = Usuário, Gestor e cada pessoa; linhas = permissões.
 * Cargo: liga/desliga. Pessoa: clique alterna Padrão do cargo → Liberar → Bloquear.
 */
export function PermissionMatrix({ users, roles: initialRoles }: { users: MatrixUser[]; roles: Roles }) {
  const [roles, setRoles] = useState<Roles>(initialRoles);
  const [per, setPer] = useState<Record<number, PermissionMap>>(Object.fromEntries(users.map((u) => [u.id, u.perms])));
  const { run, pending } = useRun();
  const dirty = JSON.stringify(roles) !== JSON.stringify(initialRoles) || users.some((u) => JSON.stringify(per[u.id]) !== JSON.stringify(u.perms));

  const effective = (u: MatrixUser, key: string) => {
    const def = PERMISSIONS.find((p) => p.key === key)!;
    return u.roles.some((r) => r !== "admin" && (key in roles[r as RoleKey] ? roles[r as RoleKey][key] : def.defaults.includes(r)));
  };
  const cols = `minmax(15rem,1fr) repeat(${2 + users.length}, minmax(5.5rem,6.5rem))`;
  const cycle = (id: number, key: string) => {
    const cur = per[id] ?? {};
    const next = { ...cur };
    if (!(key in cur)) next[key] = true; else if (cur[key]) next[key] = false; else delete next[key];
    setPer({ ...per, [id]: next });
  };

  return (
    <div className="space-y-4">
      <div className={`${panelCls} overflow-x-auto`}>
        <div className="min-w-max">
          <div className="sticky top-14 z-10 grid items-end gap-x-2 border-b border-line bg-panel px-4 py-3" style={{ gridTemplateColumns: cols }}>
            <span className="text-sm font-medium text-muted">Permissão</span>
            {(["user", "manager"] as const).map((r) => <span key={r} className="text-center text-sm font-semibold">{r === "user" ? "Usuário" : "Gestor"}<span className="block text-[11px] font-normal text-muted">padrão do cargo</span></span>)}
            {users.map((u) => (
              <span key={u.id} className="flex flex-col items-center gap-1 text-center text-sm font-semibold">
                <span className="flex size-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: u.hex }}>{u.name.slice(0, 2).toUpperCase()}</span>
                {u.name.split(" ")[0]}
              </span>
            ))}
          </div>
          {SECTIONS.map((sec) => (
            <div key={sec.group}>
              <div className="bg-sunk px-4 py-2"><span className="text-sm font-semibold">{sec.title}</span> <span className="text-xs text-muted">· {sec.hint}</span></div>
              {PERMISSIONS.filter((p) => p.group === sec.group).map((p) => (
                <div key={p.key} className="grid items-center gap-x-2 border-b border-line/60 px-4 py-2 text-sm hover:bg-sunk/50" style={{ gridTemplateColumns: cols }}>
                  <span>{p.label}</span>
                  {(["user", "manager"] as const).map((r) => {
                    const on = p.key in roles[r] ? !!roles[r][p.key] : p.defaults.includes(r);
                    return (
                      <span key={r} className="flex justify-center">
                        <button type="button" role="switch" aria-checked={on} aria-label={`${p.label} para ${r === "user" ? "Usuário" : "Gestor"}`} onClick={() => setRoles({ ...roles, [r]: { ...roles[r], [p.key]: !on } })}
                          className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-ok" : "bg-line"}`}>
                          <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-[1.375rem]" : "left-0.5"}`} />
                        </button>
                      </span>
                    );
                  })}
                  {users.map((u) => {
                    const own = per[u.id] ?? {};
                    const has = p.key in own;
                    const eff = has ? own[p.key] : effective(u, p.key);
                    return (
                      <span key={u.id} className="flex justify-center">
                        <button type="button" onClick={() => cycle(u.id, p.key)} aria-label={`${p.label} para ${u.name}: ${has ? (own[p.key] ? "liberado" : "bloqueado") : "padrão do cargo"}`}
                          title={has ? (own[p.key] ? "Liberado só para esta pessoa (clique para bloquear)" : "Bloqueado só para esta pessoa (clique para voltar ao padrão)") : `Segue o cargo: ${eff ? "vê" : "não vê"} (clique para liberar)`}
                          className={`flex size-8 items-center justify-center rounded-lg border-2 transition ${has ? (own[p.key] ? "border-ok bg-ok/15 text-ok" : "border-danger bg-danger/15 text-danger") : "border-transparent bg-sunk text-muted"}`}>
                          {has ? (own[p.key] ? <Check size={16} /> : <X size={16} />) : eff ? <Check size={14} className="opacity-50" /> : <Minus size={14} className="opacity-50" />}
                        </button>
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted">
        Interruptor = padrão do cargo. Nas colunas das pessoas: <b>cinza</b> segue o cargo, <b className="text-ok">verde ✓</b> libera só para ela, <b className="text-danger">vermelho ✕</b> bloqueia só para ela. O Adm sempre vê tudo.
      </p>

      <div className={`sticky bottom-4 z-10 flex items-center gap-3 rounded-xl border bg-panel p-3 shadow-lg transition ${dirty ? "border-accent" : "border-line opacity-70"}`}>
        <span className="flex-1 text-sm">{dirty ? "Há alterações ainda não salvas." : "Tudo salvo."}</span>
        <button type="button" className={btnGhost} disabled={!dirty || pending} onClick={() => { setRoles(initialRoles); setPer(Object.fromEntries(users.map((u) => [u.id, u.perms]))); }}>Descartar</button>
        <button type="button" className={btnPrimary} disabled={!dirty || pending} onClick={() => run(() => savePermissionMatrixAction({ roles, users: per }))}>Salvar permissões</button>
      </div>
    </div>
  );
}
