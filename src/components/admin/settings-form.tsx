"use client";

import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnPrimary, inputCls, panelCls } from "@/components/ui";
import { saveSettingsAction } from "@/modules/admin/config";
import type { SettingKey } from "@/modules/settings/get";

const FIELDS: { key: SettingKey; label: string; hint: string }[] = [
  { key: "lock_minutes", label: "Minutos até liberar um lead parado", hint: "Passou disso sem atividade, o lead volta ao sorteio." },
  { key: "skip_hours", label: "Horas que um lead pulado fica escondido", hint: "Só some para quem pulou." },
  { key: "sem_contato_days", label: "Dias até “Sem contato” voltar ao sorteio", hint: "Dias corridos." },
  { key: "rework_days", label: "Dias até um lead já trabalhado voltar ao sorteio", hint: "Quando nenhuma situação define outro prazo. Dias corridos." },
];

export function SettingsForm({ initial }: { initial: Record<SettingKey, number> }) {
  const [v, setV] = useState(initial);
  const { run, pending } = useRun();
  return (
    <form className={`${panelCls} max-w-3xl space-y-3 p-5 sm:p-6`} onSubmit={(e) => { e.preventDefault(); run(() => saveSettingsAction(v)); }}>
      <h2 className="display text-xl">Regras do sorteio</h2>
      <div className="divide-y divide-line">
        {FIELDS.map((f) => (
          <label key={f.key} className="grid items-center gap-x-6 gap-y-1 py-3 text-sm sm:grid-cols-[1fr_8rem]">
            <span><span className="block font-medium">{f.label}</span><span className="mt-0.5 block text-xs text-muted">{f.hint}</span></span>
            <input type="number" min={0} className={`${inputCls} text-center`} value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: Number(e.target.value) })} />
          </label>
        ))}
      </div>
      <button type="submit" disabled={pending} className={btnPrimary}>Salvar parâmetros</button>
    </form>
  );
}
