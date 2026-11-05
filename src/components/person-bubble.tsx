/** Bolha com a cor escolhida pela pessoa (a mesma em todo o sistema). */
export function PersonBubble({ name, hex, prefix }: { name: string; hex: string; prefix?: string }) {
  return (
    <span title={prefix ? `${prefix}: ${name}` : name} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: `color-mix(in srgb, ${hex} 22%, transparent)`, color: `color-mix(in srgb, ${hex} 75%, var(--ink))`, border: `1px solid color-mix(in srgb, ${hex} 45%, transparent)` }}>
      {prefix && <span className="opacity-70">{prefix}:</span>} {name.split(" ")[0]}
    </span>
  );
}
