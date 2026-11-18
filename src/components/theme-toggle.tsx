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

/** Cartão do menu do perfil: um toque alterna claro/noturno, com o ícone girando na troca. */
export function ThemeTile() {
  const [mode, setMode] = useState<Mode>("light");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || saved === "light") setMode(saved);
      else setMode(document.documentElement.classList.contains("dark") ? "dark" : "light");
    } catch {}
  }, []);
  const dark = mode === "dark";
  function flip() {
    const next: Mode = dark ? "light" : "dark";
    setMode(next);
    try { localStorage.setItem("theme", next); } catch {}
    apply(next);
  }
  return (
    <button type="button" role="switch" aria-checked={dark} onClick={flip} className="menu-tile group flex flex-col gap-2 rounded-2xl bg-sunk p-3 text-left text-sm font-semibold transition hover:-translate-y-0.5 hover:shadow-md">
      <span className="relative grid size-9 place-items-center overflow-hidden rounded-xl bg-grad-soft text-accent">
        <Sun size={17} aria-hidden className={`absolute transition-all duration-500 ${dark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
        <Moon size={17} aria-hidden className={`absolute transition-all duration-500 ${dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`} />
      </span>
      <span>{dark ? "Modo noturno" : "Modo claro"}<span className="block text-xs font-normal text-muted">Toque para trocar</span></span>
    </button>
  );
}
