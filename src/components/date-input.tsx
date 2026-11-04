"use client";

import { useEffect, useState } from "react";
import { inputCls } from "./ui";

const toBr = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

/** Converte "DD/MM/AAAA" em "AAAA-MM-DD"; devolve "" se a data não existir. */
export function brToIso(br: string): string {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const [, d, mo, y] = m;
  const t = new Date(Date.UTC(+y, +mo - 1, +d));
  return t.getUTCFullYear() === +y && t.getUTCMonth() === +mo - 1 && t.getUTCDate() === +d ? `${y}-${mo}-${d}` : "";
}

/** Campo de data que mostra e aceita sempre DD/MM/AAAA, independente do idioma do navegador. */
export function DateInput({ value, onChange, label }: { value: string; onChange: (iso: string) => void; label: string }) {
  const [text, setText] = useState(toBr(value));
  useEffect(() => setText(toBr(value)), [value]);
  return (
    <input
      className={inputCls}
      inputMode="numeric"
      placeholder="DD/MM/AAAA"
      aria-label={label}
      maxLength={10}
      value={text}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
        const masked = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
        setText(masked);
        if (masked === "") onChange("");
        else if (masked.length === 10) { const iso = brToIso(masked); if (iso) onChange(iso); }
      }}
    />
  );
}
