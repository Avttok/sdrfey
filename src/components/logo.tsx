export function Logo({ size = "md", tone = "brand" }: { size?: "md" | "lg"; tone?: "brand" | "light" }) {
  return (
    <span className={`display inline-flex items-baseline gap-1.5 font-bold ${size === "lg" ? "text-4xl" : "text-xl"}`}
      style={tone === "light" ? { color: "#fff", textShadow: "0 2px 12px rgb(0 0 0 / .35)" } : { backgroundImage: "linear-gradient(135deg, #ef4444, #D7191F 45%, #9f1239)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
      SDR<span>FEY</span>
    </span>
  );
}
