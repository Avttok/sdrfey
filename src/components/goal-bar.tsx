/** Barra que enche conforme o número sobe; vira verde ao bater a meta. */
export function GoalBar({ label, value, qty, alt }: { label: string; value: number; qty: number; alt?: boolean }) {
  const pct = qty > 0 ? Math.min(100, (value / qty) * 100) : 0;
  const done = qty > 0 && value >= qty;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-medium text-muted">{label}</span>
        <span className="figure text-sm font-bold text-ink">{value}<span className="font-normal text-muted"> / {qty}</span>{done ? " ✓" : ""}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={qty} aria-label={label}>
        <div className={`h-full rounded-full transition-[width] duration-700 ease-out ${done ? "bg-ok" : alt ? "bg-warn" : "bg-accent"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
