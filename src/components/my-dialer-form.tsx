"use client";

import { useState } from "react";
import { btnPrimary, inputCls } from "@/components/ui";
import { useRun } from "@/components/use-run";
import { saveMyVocallAction } from "@/modules/vocall/actions";

/** Agente e ramal do VocallPhone de quem está logado (como aparecem na EOX). */
export function MyDialerForm({ agentId, ramal }: { agentId: string; ramal: string }) {
  const [a, setA] = useState(agentId);
  const [r, setR] = useState(ramal);
  const { run, pending } = useRun();
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => saveMyVocallAction(a, r)); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">Agente<input className={`${inputCls} mt-1`} inputMode="numeric" maxLength={30} value={a} onChange={(e) => setA(e.target.value)} placeholder="Ex.: 164" /></label>
        <label className="block text-sm font-medium">Ramal<input className={`${inputCls} mt-1`} inputMode="numeric" maxLength={30} value={r} onChange={(e) => setR(e.target.value)} placeholder="Ex.: 7311" /></label>
      </div>
      <p className="text-xs text-muted">Os mesmos números que aparecem no VocallPhone (agente e ramal). Os dois vazios = você não liga pelo sistema.</p>
      <button type="submit" className={btnPrimary} disabled={pending || (a === agentId && r === ramal)}>Salvar agente e ramal</button>
    </form>
  );
}
