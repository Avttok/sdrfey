export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className={`display inline-flex items-baseline gap-1.5 ${size === "lg" ? "text-4xl" : "text-xl"}`}>
      SDR<span className="text-muted">Fey</span>
    </span>
  );
}
