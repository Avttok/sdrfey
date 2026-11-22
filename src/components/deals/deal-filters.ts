import type { DealStage } from "@/db/schema";
import type { DealAlertKind } from "@/modules/deals/queries";
import type { DealWithExtra } from "@/modules/deals/extras";

export type Scope = "todas" | "minhas" | "grupo" | "avisos" | "fechadas";
export type Sort = "recentes" | "valor" | "parados" | "retorno" | "empresa" | "antigas";
export type Tri = "" | "sim" | "nao";

/** Todos os filtros da lista de negociações. Vazio = não filtra. */
export type DF = {
  q: string; scope: Scope; stages: DealStage[]; seller: string; sdr: string; uf: string; city: string; alerts: DealAlertKind[];
  min: string; max: string; from: string; to: string; idle: string; quote: Tri; script: Tri; visit: Tri; react: boolean; color: string; sort: Sort;
};
export const NO_FILTER: DF = { q: "", scope: "todas", stages: [], seller: "", sdr: "", uf: "", city: "", alerts: [], min: "", max: "", from: "", to: "", idle: "", quote: "", script: "", visit: "", react: false, color: "", sort: "recentes" };

export const SORTS: [Sort, string][] = [["recentes", "Mais recentes"], ["valor", "Maior valor"], ["parados", "Parados há mais tempo"], ["retorno", "Próximo retorno"], ["antigas", "Mais antigas"], ["empresa", "Empresa (A–Z)"]];
export const ALERT_LABEL: Record<DealAlertKind, string> = { pool: "Sem vendedor", novo: "Ligar agora", retorno: "Retorno vencido", cobrar: "Cobrar cotação", parado: "Parado" };

export const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** "1.234,56" → centavos. Vazio ou inválido = null. */
export function reaisToCents(s: string): number | null {
  const t = s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
export const isOpenDeal = (d: { stage: DealStage }) => d.stage !== "ganho" && d.stage !== "perdido";

/** Quantos filtros estão ligados (a busca e o atalho de grupo contam; a ordenação não). */
export function activeCount(f: DF): number {
  return (f.q.trim() ? 1 : 0) + (f.scope !== "todas" ? 1 : 0) + (f.stages.length ? 1 : 0) + (f.seller ? 1 : 0) + (f.sdr ? 1 : 0) + (f.uf ? 1 : 0) + (f.city.trim() ? 1 : 0) + (f.alerts.length ? 1 : 0)
    + (f.min || f.max ? 1 : 0) + (f.from || f.to ? 1 : 0) + (f.idle ? 1 : 0) + (f.quote ? 1 : 0) + (f.script ? 1 : 0) + (f.visit ? 1 : 0) + (f.react ? 1 : 0) + (f.color ? 1 : 0);
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
/** Última vez que alguém mexeu na negociação: contato, evento ou, na falta, a criação. */
export const lastTouch = (d: DealWithExtra) => d.lastContactAt ?? d.x.lastEventAt ?? d.claimedAt ?? d.createdAt;

export function matches(d: DealWithExtra, f: DF, meId: number, now = Date.now()): boolean {
  const needle = norm(f.q.trim()); const digits = f.q.replace(/\D/g, "");
  if (needle && !(norm(`${d.company} ${d.contactName ?? ""} ${d.x.talkedTo ?? ""} ${d.city ?? ""} ${d.sellerName ?? ""} ${d.sdrName ?? ""} ${d.quoteNumber ?? ""} ${d.orderNumber ?? ""} ${d.email ?? ""}`).includes(needle) || (digits.length >= 3 && (d.cnpj.includes(digits) || (d.phone ?? "").includes(digits))))) return false;
  if (f.scope === "minhas" && d.sellerId !== meId) return false;
  if (f.scope === "grupo" && d.sellerId) return false;
  if (f.scope === "avisos" && !d.alerts.length) return false;
  if (f.stages.length && !f.stages.includes(d.stage)) return false;
  if (f.seller === "0" ? d.sellerId : f.seller ? String(d.sellerId) !== f.seller : false) return false;
  if (f.sdr && String(d.sdrId) !== f.sdr) return false;
  if (f.uf && d.uf !== f.uf) return false;
  if (f.city.trim() && !norm(d.city ?? "").includes(norm(f.city.trim()))) return false;
  if (f.alerts.length && !d.alerts.some((a) => f.alerts.includes(a.kind))) return false;
  const lo = reaisToCents(f.min), hi = reaisToCents(f.max);
  if (lo !== null && (d.mainCents ?? 0) < lo) return false;
  if (hi !== null && (d.mainCents ?? 0) > hi) return false;
  if (f.from && day(d.createdAt) < f.from) return false;
  if (f.to && day(d.createdAt) > f.to) return false;
  if (f.idle && isOpenDeal(d) && (now - new Date(lastTouch(d)).getTime()) / 86400_000 < Number(f.idle)) return false;
  if (f.idle && !isOpenDeal(d)) return false;
  if (f.quote === "sim" && !d.x.quotes) return false;
  if (f.quote === "nao" && d.x.quotes) return false;
  if (f.script === "sim" && !d.x.scriptRuns) return false;
  if (f.script === "nao" && d.x.scriptRuns) return false;
  if (f.visit === "sim" && !d.x.visits) return false;
  if (f.visit === "nao" && d.x.visits) return false;
  if (f.react && !d.isReactivation) return false;
  if (f.color && d.color !== f.color) return false;
  return true;
}

export function sortDeals<T extends DealWithExtra>(list: T[], s: Sort): T[] {
  const t = (x: string | null) => (x ? new Date(x).getTime() : Infinity);
  const by: Record<Sort, (a: T, b: T) => number> = {
    recentes: () => 0,
    valor: (a, b) => (b.mainCents ?? 0) - (a.mainCents ?? 0),
    parados: (a, b) => t(lastTouch(a)) - t(lastTouch(b)),
    retorno: (a, b) => t(a.nextActionAt) - t(b.nextActionAt),
    antigas: (a, b) => t(a.createdAt) - t(b.createdAt),
    empresa: (a, b) => a.company.localeCompare(b.company, "pt-BR"),
  };
  return s === "recentes" ? list : [...list].sort(by[s]);
}
