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
    <form className={`${panelCls} max-w-2xl space-y-4 p-5`} onSubmit={(e) => { e.preventDefault(); run(() => saveSettingsAction(v)); }}>
      {FIELDS.map((f) => (
        <label key={f.key} className="block text-sm">
          <span className="font-medium">{f.label}</span>
          <input type="number" min={0} className={`${inputCls} mt-1 max-w-40`} value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: Number(e.target.value) })} />
          <span className="mt-1 block text-xs text-muted">{f.hint}</span>
        </label>
      ))}
      <button type="submit" disabled={pending} className={btnPrimary}>Salvar parâmetros</button>
    </form>
  );
}
