"use client";

import { PERMISSIONS } from "@/config/permissions";

const GROUPS = ["Abas", "Painel", "Funções"] as const;

/** Cargo: caixa liga/desliga. Pessoa: Padrão do cargo / Liberar / Bloquear. */
export function PermissionGrid({ mode, value, onChange }: { mode: "role" | "user"; value: Record<string, boolean>; onChange: (v: Record<string, boolean>) => void }) {
  return (
    <div className="space-y-4">
      {GROUPS.map((g) => (
        <fieldset key={g}>
          <legend className="mb-1.5 text-sm font-medium">{g === "Painel" ? "Blocos do Painel" : g}</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {PERMISSIONS.filter((p) => p.group === g).map((p) =>
              mode === "role" ? (
                <label key={p.key} className="flex items-center gap-2 rounded-lg bg-sunk px-3 py-2 text-sm">
                  <input type="checkbox" checked={!!value[p.key]} onChange={(e) => onChange({ ...value, [p.key]: e.target.checked })} /> {p.label}
                </label>
              ) : (
                <label key={p.key} className="flex items-center justify-between gap-2 rounded-lg bg-sunk px-3 py-2 text-sm">
                  <span>{p.label}</span>
                  <select
                    aria-label={p.label}
                    className="rounded-md border border-line bg-panel px-1.5 py-1 text-xs"
                    value={p.key in value ? (value[p.key] ? "1" : "0") : ""}
                    onChange={(e) => {
                      const n = { ...value };
                      if (e.target.value === "") delete n[p.key];
                      else n[p.key] = e.target.value === "1";
                      onChange(n);
                    }}
                  >
                    <option value="">Padrão do cargo</option>
                    <option value="1">Liberar</option>
                    <option value="0">Bloquear</option>
                  </select>
                </label>
              ),
            )}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
