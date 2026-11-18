import { Cloud } from "lucide-react";

/** Ícone do Salesforce: uma nuvem. */
export function SalesforceIcon({ size = 15 }: { size?: number }) {
  return <Cloud size={size} fill="currentColor" aria-hidden />;
}

/** Ícone do CRM EOX: a letra E. */
export function EoxIcon({ size = 15 }: { size?: number }) {
  return <span aria-hidden className="inline-grid shrink-0 place-items-center font-black leading-none" style={{ width: size, height: size, fontSize: size }}>E</span>;
}
