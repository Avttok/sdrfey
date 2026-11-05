"use client";

import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnPrimary, inputCls } from "@/components/ui";
import { setDisplayNameAction } from "@/modules/users/actions";

export function DisplayNameForm({ name, username }: { name: string; username: string }) {
  const [v, setV] = useState(name);
  const { run, pending } = useRun();
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => setDisplayNameAction(v)); }}>
      <label className="block text-sm font-medium">Nome de exibição<input className={`${inputCls} mt-1`} value={v} maxLength={60} onChange={(e) => setV(e.target.value)} /></label>
      <p className="text-xs text-muted">Login: <b>{username}</b> (não pode ser alterado)</p>
      <button type="submit" className={btnPrimary} disabled={pending || v.trim() === name}>Salvar nome</button>
    </form>
  );
}
