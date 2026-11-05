"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Mode = "light" | "dark";
const OPTIONS: { mode: Mode; label: string; Icon: typeof Sun }[] = [
  { mode: "light", label: "Claro", Icon: Sun },
  { mode: "dark", label: "Noturno", Icon: Moon },
];

function apply(mode: Mode) {
  const dark = mode === "dark";
  document.documentElement.classList.toggle("dark", dark);
}

/** Alterna claro / noturno e lembra a escolha neste navegador. */
export function ThemeToggle({ withLabels = false }: { withLabels?: boolean }) {
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme") as Mode | null;
      if (saved === "dark" || saved === "light") setMode(saved);
    } catch {}
  }, []);

  function choose(next: Mode) {
    setMode(next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
    apply(next);
  }

  return (
    <div role="radiogroup" aria-label="Tema" className="inline-flex rounded-lg border border-line bg-sunk p-0.5">
      {OPTIONS.map(({ mode: m, label, Icon }) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          aria-label={label}
          title={label}
          onClick={() => choose(m)}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
            mode === m ? "bg-panel font-medium text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          <Icon size={16} aria-hidden />
          {withLabels && <span>{label}</span>}
        </button>
      ))}
    </div>
  );
}
