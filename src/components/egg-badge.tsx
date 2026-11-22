/** O Douradovo: selo de quem achou o segredo. Brilha, balança de leve e solta um reflexo. */
export function EggBadge({ size = 28, className = "", title = "Douradovo: achou o segredo!" }: { size?: number; className?: string; title?: string }) {
  return (
    <span role="img" aria-label={title} title={title} className={`egg-gold inline-block shrink-0 ${className}`} style={{ width: size, height: size * 1.2 }}>
      <svg viewBox="0 0 40 48" width="100%" height="100%" aria-hidden>
        <defs>
          <radialGradient id="egg-g" cx="36%" cy="30%" r="80%"><stop offset="0" stopColor="#FFF7C2" /><stop offset=".35" stopColor="#FBBF24" /><stop offset=".75" stopColor="#D97706" /><stop offset="1" stopColor="#92400E" /></radialGradient>
        </defs>
        <path d="M20 2C11 2 3.5 17 3.5 29c0 9.4 7.1 17 16.5 17s16.5-7.6 16.5-17C36.5 17 29 2 20 2Z" fill="url(#egg-g)" stroke="#78350F" strokeWidth="1.6" />
        <path d="M5 28c4-3 7 3 11 0s7-3 10 0 6 3 9 0" fill="none" stroke="#FFF7C2" strokeOpacity=".75" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="13" cy="14" r="2.4" fill="#fff" fillOpacity=".8" />
        <path d="M20 33l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5Z" fill="#FFF7C2" fillOpacity=".9" />
      </svg>
    </span>
  );
}
