"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnPrimary, inputCls, panelCls } from "@/components/ui";
import { createUserAction } from "@/modules/admin/users";

export function NewUser() {
  const [f, setF] = useState({ username: "", name: "" });
  const { run, pending } = useRun();
  return (
    <form className={`${panelCls} flex flex-wrap items-end gap-3 p-4`} onSubmit={(e) => { e.preventDefault(); run(() => createUserAction({ ...f, roles: ["user"] }), undefined, () => setF({ username: "", name: "" })); }}>
      <label className="text-sm">Login<input className={inputCls} placeholder="nome.sobrenome" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></label>
      <label className="text-sm">Nome<input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <button type="submit" disabled={pending} className={btnPrimary}><Plus size={16} aria-hidden /> Criar usuário</button>
    </form>
  );
}
