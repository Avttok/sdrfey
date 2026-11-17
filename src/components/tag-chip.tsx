/** Chip de tag com a cor própria dela (a cor do cargo nunca aparece aqui). */
export function TagChip({ label, color, on, onClick, small = true }: { label: string; color: string; on?: boolean; onClick?: () => void; small?: boolean }) {
  const base = `inline-flex items-center gap-1 rounded-md border ${small ? "px-2 py-0.5 text-xs" : "px-3 py-1.5 text-sm"} font-semibold uppercase tracking-wide`;
  const style = {
    background: `color-mix(in srgb, ${color} ${on ? 42 : 16}%, transparent)`,
    borderColor: `color-mix(in srgb, ${color} ${on ? 100 : 45}%, transparent)`,
    color: `color-mix(in srgb, ${color} 70%, var(--ink))`,
    outline: on ? `1.5px solid ${color}` : undefined,
  } as const;
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={!!on} className={`${base} cursor-pointer transition active:scale-[0.97]`} style={style}>
      {on && <span aria-hidden>✓</span>}
      {label}
    </button>
  ) : (
    <span className={base} style={style}>
      {label}
    </span>
  );
}
