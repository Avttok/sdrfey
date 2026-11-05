export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className={`display inline-flex items-baseline gap-1.5 font-bold ${size === "lg" ? "text-4xl" : "text-xl"}`} style={{ color: "#D7191F" }}>
      SDR<span>FEY</span>
    </span>
  );
}
