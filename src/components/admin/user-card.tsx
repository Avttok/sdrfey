"use client";

import { ChevronDown, KeyRound, Trash2 } from "lucide-react";
import { useState } from "react";
import { PermissionGrid } from "@/components/admin/permission-grid";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { ROLE_META, ROLES, type Role } from "@/config/roles";
import { deleteUserAction, resetPasswordAction, updateUserAction } from "@/modules/admin/users";

export type UserRow = { id: number; username: string; name: string; roles: Role[]; active: boolean; dailyGoal: number | null; canManageGoals: boolean; inMetrics: boolean; permissions: Record<string, boolean>; hex: string; lastLoginAt: string | null };

/** Central de edição da pessoa: dados, cargos, abas e painéis permitidos, metas. */
export function UserCard({ u, isMe }: { u: UserRow; isMe: boolean }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"dados" | "perm" | "metas">("dados");
  const [f, setF] = useState(u);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { run, pending } = useRun();
  const toggleRole = (r: Role) => setF({ ...f, roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r] });
  return (
    <li className={`${panelCls} ${u.active ? "" : "opacity-70"}`}>
      <button type="button" className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="flex size-9 items-center justify-center rounded-full text-sm font-semibold" style={{ background: `color-mix(in srgb, ${u.hex} 28%, transparent)`, color: `color-mix(in srgb, ${u.hex} 80%, var(--ink))` }}>{u.name.slice(0, 2).toUpperCase()}</span>
        <span className="flex-1"><span className="block font-medium">{u.name} <span className="text-xs text-muted">@{u.username}</span></span><span className="text-xs text-muted">{u.roles.map((r) => ROLE_META[r].label).join(" + ")}{u.active ? "" : " · bloqueado"}</span></span>
        <ChevronDown size={18} className={open ? "rotate-180" : ""} aria-hidden />
      </button>
      {open && (
        <div className="space-y-4 border-t border-line p-4">
          <div className="flex gap-1.5">
            {([["dados", "Dados e cargos"], ["perm", "Abas e permissões"], ["metas", "Metas"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === k ? "bg-accent text-on-accent" : "hover:bg-sunk"}`}>{l}</button>
            ))}
          </div>
          {tab === "dados" && (
            <div className="space-y-3">
              <label className="block max-w-sm text-sm">Nome<input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
              <fieldset><legend className="mb-1 text-sm font-medium">Cargos</legend>
                <div className="flex flex-wrap gap-2">{ROLES.map((r) => <label key={r} className="flex items-center gap-2 rounded-lg bg-sunk px-3 py-2 text-sm"><input type="checkbox" checked={f.roles.includes(r)} onChange={() => toggleRole(r)} /> {ROLE_META[r].label}</label>)}</div></fieldset>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} disabled={isMe} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Ativo (desmarcar bloqueia o acesso)</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.inMetrics} onChange={(e) => setF({ ...f, inMetrics: e.target.checked })} /> Aparece nas métricas (Dashboard, Metas, ranking)</label>
              <p className="text-xs text-muted">Último acesso: {u.lastLoginAt ?? "nunca"}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnGhost} disabled={pending} onClick={() => { if (confirm(`Redefinir a senha de ${u.name} para a inicial?`)) run(() => resetPasswordAction(u.id)); }}><KeyRound size={15} aria-hidden /> Redefinir senha</button>
                {!isMe && !confirmDelete && <button type="button" className={`${btnGhost} text-danger`} disabled={pending} onClick={() => setConfirmDelete(true)}><Trash2 size={15} aria-hidden /> Excluir</button>}
                {!isMe && confirmDelete && (
                  <span className="flex flex-wrap items-center gap-2 rounded-lg border border-danger/50 px-3 py-1.5 text-sm">
                    <span className="font-medium text-danger">Excluir {u.name} TOTALMENTE? Não dá para desfazer.</span>
                    <button type="button" disabled={pending} className={`${btnGhost} !border-danger !bg-danger !text-white`} onClick={() => run(() => deleteUserAction(u.id))}>Sim, excluir</button>
                    <button type="button" className={btnGhost} onClick={() => setConfirmDelete(false)}>Cancelar</button>
                  </span>
                )}
              </div>
            </div>
          )}
          {tab === "perm" && (
            <div className="space-y-2"><p className="text-sm text-muted">“Padrão do cargo” segue o que está em Permissões por cargo. O Adm sempre tem tudo.</p><PermissionGrid mode="user" value={f.permissions} onChange={(permissions) => setF({ ...f, permissions })} /></div>
          )}
          {tab === "metas" && (
            <div className="space-y-3">
              <label className="block max-w-xs text-sm">Meta diária própria (contatos)<input type="number" min={0} className={inputCls} placeholder="Vazio = meta global" value={f.dailyGoal ?? ""} onChange={(e) => setF({ ...f, dailyGoal: e.target.value === "" ? null : Number(e.target.value) })} /></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.canManageGoals} onChange={(e) => setF({ ...f, canManageGoals: e.target.checked })} /> Pode alterar as metas da equipe</label>
            </div>
          )}
          <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => updateUserAction(u.id, { name: f.name, roles: f.roles, active: f.active, dailyGoal: f.dailyGoal, canManageGoals: f.canManageGoals, inMetrics: f.inMetrics, permissions: f.permissions }))}>Salvar</button>
        </div>
      )}
    </li>
  );
}
