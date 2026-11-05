"use client";

import { Clock, KeyRound, Pencil, ShieldCheck, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { ROLE_META, ROLES, type Role } from "@/config/roles";
import { deleteUserAction, resetPasswordAction, updateUserAction } from "@/modules/admin/users";

export type UserRow = { id: number; username: string; name: string; roles: Role[]; active: boolean; dailyGoal: number | null; canManageGoals: boolean; inMetrics: boolean; permissions: Record<string, boolean>; hex: string; lastLoginAt: string | null; online: boolean };

const ROLE_TONE: Record<Role, string> = { user: "#3b82f6", manager: "#eab308", admin: "#ef4444" };

/** Cartão da pessoa; “Editar” abre uma janela só com o que é configurado aqui: nome, cargos, acesso e senha. */
export function UserCard({ u, isMe }: { u: UserRow; isMe: boolean }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(u);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { run, pending } = useRun();
  const toggleRole = (r: Role) => setF({ ...f, roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r] });
  const close = () => { setOpen(false); setConfirmDelete(false); setF(u); };
  return (
    <li className={`${panelCls} group relative overflow-hidden transition hover:border-accent/50 hover:shadow-md ${u.active ? "" : "opacity-75"}`}>
      <div aria-hidden className="h-1.5" style={{ background: u.hex }} />
      <div className="flex items-start gap-3 p-4">
        <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl text-base font-bold" style={{ background: `color-mix(in srgb, ${u.hex} 26%, transparent)`, color: `color-mix(in srgb, ${u.hex} 80%, var(--ink))` }}>
          {u.name.slice(0, 2).toUpperCase()}
          <span title={u.online ? "Online agora" : "Offline"} className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-panel ${u.online ? "bg-ok" : "bg-muted/50"}`} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{u.name}{isMe && <span className="ml-1.5 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">você</span>}</p>
          <p className="truncate text-xs text-muted">@{u.username}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {u.roles.map((r) => <span key={r} className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `color-mix(in srgb, ${ROLE_TONE[r]} 18%, transparent)`, color: `color-mix(in srgb, ${ROLE_TONE[r]} 75%, var(--ink))` }}>{ROLE_META[r].label}</span>)}
            {!u.active && <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-semibold text-danger">Bloqueado</span>}
            {!u.inMetrics && <span className="rounded-full bg-sunk px-2 py-0.5 text-[11px] font-medium text-muted">Fora das métricas</span>}
          </div>
        </div>
        <button type="button" onClick={() => setOpen(true)} className={`${btnGhost} !px-2.5`} aria-label={`Editar ${u.name}`}><Pencil size={15} aria-hidden /> Editar</button>
      </div>
      <p className="flex items-center gap-1.5 border-t border-line px-4 py-2 text-xs text-muted"><Clock size={12} aria-hidden /> Último acesso: {u.lastLoginAt ?? "nunca"}</p>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={`Editar ${u.name}`} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className={`${panelCls} max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto p-6 shadow-2xl`}>
            <div className="flex items-start gap-3">
              <span className="grid size-11 place-items-center rounded-2xl text-sm font-bold" style={{ background: `color-mix(in srgb, ${u.hex} 26%, transparent)`, color: `color-mix(in srgb, ${u.hex} 80%, var(--ink))` }}>{u.name.slice(0, 2).toUpperCase()}</span>
              <div className="flex-1"><h2 className="display text-xl">Editar pessoa</h2><p className="text-xs text-muted">@{u.username} · metas ficam em Metas e permissões em Permissões</p></div>
              <button type="button" aria-label="Fechar" className="rounded-lg p-1.5 hover:bg-sunk" onClick={close}><X size={18} /></button>
            </div>
            <label className="block text-sm"><span className="mb-1 block text-muted">Nome</span><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <fieldset>
              <legend className="mb-1.5 flex items-center gap-1.5 text-sm text-muted"><ShieldCheck size={14} aria-hidden /> Cargos</legend>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map((r) => { const on = f.roles.includes(r); return (
                  <button key={r} type="button" aria-pressed={on} onClick={() => toggleRole(r)} className={`rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition ${on ? "" : "border-line text-muted hover:bg-sunk"}`} style={on ? { borderColor: ROLE_TONE[r], background: `color-mix(in srgb, ${ROLE_TONE[r]} 14%, transparent)` } : undefined}>{ROLE_META[r].label}</button>
                ); })}
              </div>
            </fieldset>
            <div className="space-y-2.5">
              <Toggle on={f.active} disabled={isMe} onChange={(v) => setF({ ...f, active: v })} title="Acesso liberado" hint={isMe ? "Você não pode bloquear a si mesmo." : "Desligar bloqueia o login imediatamente."} />
              <Toggle on={f.inMetrics} onChange={(v) => setF({ ...f, inMetrics: v })} title="Aparece nas métricas" hint="Dashboard, Metas e ranking." />
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => updateUserAction(u.id, { name: f.name, roles: f.roles, active: f.active, dailyGoal: u.dailyGoal, canManageGoals: u.canManageGoals, inMetrics: f.inMetrics, permissions: u.permissions }), undefined, () => setOpen(false))}>Salvar</button>
              <button type="button" className={btnGhost} disabled={pending} onClick={() => { if (confirm(`Redefinir a senha de ${u.name} para a inicial?`)) run(() => resetPasswordAction(u.id)); }}><KeyRound size={15} aria-hidden /> Redefinir senha</button>
              <span className="flex-1" />
              {!isMe && !confirmDelete && <button type="button" className={`${btnGhost} text-danger`} disabled={pending} onClick={() => setConfirmDelete(true)}><Trash2 size={15} aria-hidden /> Excluir</button>}
            </div>
            {!isMe && confirmDelete && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-danger/50 bg-danger/5 p-3 text-sm">
                <span className="flex-1 font-medium text-danger">Excluir {u.name} TOTALMENTE? Não dá para desfazer.</span>
                <button type="button" disabled={pending} className={`${btnGhost} !border-danger !bg-danger !text-white`} onClick={() => run(() => deleteUserAction(u.id))}>Sim, excluir</button>
                <button type="button" className={btnGhost} onClick={() => setConfirmDelete(false)}>Cancelar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Toggle({ on, onChange, title, hint, disabled }: { on: boolean; onChange: (v: boolean) => void; title: string; hint: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)} className="flex w-full items-center gap-3 rounded-xl bg-sunk px-3.5 py-2.5 text-left disabled:opacity-60">
      <span className="flex-1"><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-muted">{hint}</span></span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-ok" : "bg-line"}`}><span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-[1.375rem]" : "left-0.5"}`} /></span>
    </button>
  );
}
