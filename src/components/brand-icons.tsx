import { Cloud, Globe } from "lucide-react";

/** Ícone do Salesforce: uma nuvem. */
export function SalesforceIcon({ size = 15 }: { size?: number }) {
  return <Cloud size={size} fill="currentColor" aria-hidden />;
}

/** Ícone do CRM EOX: a letra E. */
export function EoxIcon({ size = 15 }: { size?: number }) {
  return <span aria-hidden className="inline-grid shrink-0 place-items-center font-black leading-none" style={{ width: size, height: size, fontSize: size }}>E</span>;
}

export const SF_COLOR = "#0070d2";
export const EOX_COLOR = "#692E81";

/** Botão de link externo nas cores da marca: Salesforce sempre azul, EOX sempre roxo. */
export function BrandLink({ kind, href, label, small, className = "" }: { kind: "sf" | "eox"; href: string; label?: string; small?: boolean; className?: string }) {
  const color = kind === "sf" ? SF_COLOR : EOX_COLOR;
  const Ico = kind === "sf" ? SalesforceIcon : EoxIcon;
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{ background: color, borderColor: color }}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border font-medium text-white transition hover:brightness-110 active:scale-[0.98] ${small ? "min-h-9 px-3 text-sm" : "min-h-11 px-4 text-[15px]"} ${className}`}>
      <Ico size={small ? 14 : 15} /> {label ?? (kind === "sf" ? "Salesforce" : "CRM (EOX)")}
    </a>
  );
}

/** Redes e site do lead, cada um na cor da sua marca. */
export type SocialKind = "site" | "instagram" | "facebook" | "linkedin" | "youtube" | "tiktok" | "x" | "whatsapp";
const SOCIAL: Record<SocialKind, { label: string; bg: string }> = {
  site: { label: "Site", bg: "#334155" },
  instagram: { label: "Instagram", bg: "linear-gradient(45deg,#f09433,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888)" },
  facebook: { label: "Facebook", bg: "#1877F2" },
  linkedin: { label: "LinkedIn", bg: "#0A66C2" },
  youtube: { label: "YouTube", bg: "#FF0000" },
  tiktok: { label: "TikTok", bg: "#111111" },
  x: { label: "X", bg: "#000000" },
  whatsapp: { label: "WhatsApp", bg: "#25D366" },
};
function SocialGlyph({ kind, size }: { kind: SocialKind; size: number }) {
  const txt = (t: string) => <span aria-hidden className="inline-grid shrink-0 place-items-center font-black leading-none" style={{ width: size, height: size, fontSize: size * 0.95 }}>{t}</span>;
  switch (kind) {
    case "instagram": return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" /></svg>;
    case "facebook": return txt("f");
    case "linkedin": return <span aria-hidden className="inline-grid shrink-0 place-items-center font-black leading-none" style={{ width: size, height: size, fontSize: size * 0.8 }}>in</span>;
    case "youtube": return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" /><path d="M10 9l5 3-5 3z" fill="#FF0000" /></svg>;
    case "tiktok": return txt("♪");
    case "x": return txt("𝕏");
    case "whatsapp": return txt("W");
    default: return <Globe size={size} aria-hidden />;
  }
}
/** Descobre qual rede é pelo endereço (site comum cai em "site"). */
export function socialKindOf(url: string): SocialKind {
  const u = url.toLowerCase();
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("facebook.com") || u.includes("fb.com")) return "facebook";
  if (u.includes("linkedin.com")) return "linkedin";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("twitter.com") || u.includes("x.com")) return "x";
  if (u.includes("wa.me") || u.includes("whatsapp.com")) return "whatsapp";
  return "site";
}
export function SocialLink({ kind, href, small = true, label, className = "" }: { kind: SocialKind; href: string; small?: boolean; label?: string; className?: string }) {
  const m = SOCIAL[kind];
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" style={{ background: m.bg }} className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold text-white transition hover:brightness-110 active:scale-[0.98] ${small ? "min-h-7 px-2 text-xs" : "min-h-9 px-3 text-sm"} ${className}`}>
      <SocialGlyph kind={kind} size={small ? 13 : 16} /> {label ?? m.label}
    </a>
  );
}
