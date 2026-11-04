"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Mode = "light" | "dark" | "system";
const OPTIONS: { mode: Mode; label: string; Icon: typeof Sun }[] = [
  { mode: "light", label: "Claro", Icon: Sun },
  { mode: "system", label: "Automático", Icon: Monitor },
  { mode: "dark", label: "Noturno", Icon: Moon },
];

function apply(mode: Mode) {
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** Alterna claro / automático / noturno e lembra a escolha neste navegador. */
export function ThemeToggle({ withLabels = false }: { withLabels?: boolean }) {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme") as Mode | null;
      if (saved) setMode(saved);
    } catch {}
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem("theme") ?? "system") === "system") apply("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
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
