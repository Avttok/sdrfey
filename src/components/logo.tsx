import { LogoView } from "@/components/logo-morph";

/** Marca da FEY (desenhada em SVG: nítida em qualquer tamanho e cor). */
export function FeyMark({ size = 28, color = "#E9283A", className = "", animated = false }: { size?: number; color?: string; className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 90 1248 1198" width={size} height={size * (1198 / 1248)} role="img" aria-label="FEY" className={`${animated ? "fey-live" : ""} ${className}`} style={animated ? { filter: color === "currentColor" ? "drop-shadow(0 0 9px color-mix(in srgb, currentColor 45%, transparent))" : `drop-shadow(0 0 7px ${color}66)` } : undefined} fill={color}>
      <path d="M0 90H1248V198H108V1287H0Z" style={{ "--i": 0 } as React.CSSProperties} />
      <path d="M216 306H1248V414H216Z" style={{ "--i": 1 } as React.CSSProperties} />
      <path d="M216 523H707V631H324V740H707V849H324V957H707V1070H216Z" style={{ "--i": 2 } as React.CSSProperties} />
      <path d="M815 525H923V968H1139V525H1248V1287H216V1179H1139V1070H815Z" style={{ "--i": 3 } as React.CSSProperties} />
    </svg>
  );
}

/** Logo do sistema: animada (FEY ⇄ SDR) ou, se o Adm desligar, a marca da FEY + “SDR”. */
export function Logo({ size = "md", tone = "brand" }: { size?: "md" | "lg"; tone?: "brand" | "light" }) {
  const light = tone === "light";
  return <LogoView size={size} tone={tone} legacy={<FeyMark animated size={size === "lg" ? 60 : 38} color={light ? "#fff" : "#E9283A"} className={light ? "fey-now" : ""} />} />;
}
