import type { DealStage } from "@/db/schema";

/** Etapas da negociação: nome, cor e o que significa. Mude aqui e a tela inteira acompanha. */
export const STAGE_META: Record<DealStage, { label: string; color: string; hint: string }> = {
  novo: { label: "Novo", color: "#3b82f6", hint: "Repassado pelo SDR, ainda sem contato do vendedor" },
  contato: { label: "Em contato", color: "#8b5cf6", hint: "Vendedor já falou com o cliente" },
  cotacao: { label: "Cotação enviada", color: "#f59e0b", hint: "Aguardando resposta da cotação" },
  negociacao: { label: "Negociando", color: "#06b6d4", hint: "Ajustando condições para fechar" },
  ganho: { label: "Venda fechada", color: "#22c55e", hint: "Negócio ganho" },
  perdido: { label: "Perdida", color: "#ef4444", hint: "Negócio perdido" },
};

export const OPEN_STAGES: DealStage[] = ["novo", "contato", "cotacao", "negociacao"];

/** Regras dos avisos (em horas/dias). Ajuste aqui. */
export const ALERT_RULES = {
  /** Negociação já com vendedor, ainda "Novo": o contato é na hora, então atrasa depois de… */
  newUntouchedHours: 2,
  /** Sem dono no grupo dos vendedores há mais de… */
  poolHours: 1,
  /** Cotação sem resposta: cobrar depois de… dias. */
  quoteChaseDays: 2,
  /** Em contato/negociando sem nenhum contato há… dias. */
  staleDays: 3,
  /** Quando manda a cotação, o retorno é agendado automaticamente para daqui a… dias. */
  defaultFollowupDays: 2,
} as const;

export const DEAL_EVENT_LABEL: Record<string, string> = {
  criado: "Repassado pelo SDR",
  assumido: "Assumiu a negociação",
  repassado: "Trocou de vendedor",
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  email: "E-mail",
  cotacao: "Cotação enviada",
  nota: "Anotação",
  etapa: "Mudou de etapa",
  retorno: "Retorno agendado",
  ganho: "Venda fechada",
  perdido: "Negócio perdido",
  reaberto: "Reaberta",
};

export const fmtBRL = (cents: number | null | undefined) =>
  cents == null ? "—" : (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** "1.234,56" ou "1234.5" → centavos (ou null se inválido). */
export function parseMoneyToCents(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) : null;
  let t = raw.replace(/[^\d.,]/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if ((t.match(/\./g) ?? []).length > 1) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n < 1e9 ? Math.round(n * 100) : null;
}
