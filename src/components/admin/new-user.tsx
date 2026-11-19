"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnPrimary, inputCls, panelCls } from "@/components/ui";
import { createUserAction } from "@/modules/admin/users";

export function NewUser() {
  const [f, setF] = useState({ username: "", name: "" });
  const { run, pending } = useRun();
  return (
    <form className={`${panelCls} space-y-3 border-dashed p-4`} onSubmit={(e) => { e.preventDefault(); run(() => createUserAction({ ...f, roles: ["user"] }), undefined, () => setF({ username: "", name: "" })); }}>
      <p className="flex items-center gap-2 text-sm font-semibold"><UserPlus size={16} className="text-accent" aria-hidden /> Nova pessoa</p>
      <label className="block text-sm"><span className="mb-1 block text-muted">Login</span><input className={inputCls} placeholder="nome.sobrenome" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></label>
      <label className="block text-sm"><span className="mb-1 block text-muted">Nome</span><input className={inputCls} placeholder="Nome e sobrenome" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}><UserPlus size={16} aria-hidden /> Criar usuário</button>
    </form>
  );
}
