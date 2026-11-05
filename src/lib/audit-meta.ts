import { fmtDateTime } from "./format";

const LABELS: Record<string, string> = {
  motivo: "Motivo", motivos: "Motivos", origem: "Origem", arquivo: "Arquivo", total: "Total", semCoordenadas: "Sem coordenadas",
  ate: "Até", contato: "Contato", id: "Código", cargos: "Cargos", interacoes: "Interações apagadas", visitasCanceladas: "Visitas canceladas",
  observacaoApagada: "Observação apagada", leads: "Leads", meios: "Meios", revertido: "Reverte o registro", telefonesNovos: "Telefones novos",
  emailsNovos: "E-mails novos", fontes: "Fontes", usuario: "Usuário", pessoa: "Pessoa",
};
const WORDS: Record<string, string> = { auto: "Automática", manual: "Manual", import: "Importação", brasilapi: "BrasilAPI", receitaws: "ReceitaWS", phone: "Telefone", email: "E-mail", ligacao: "Ligação", whatsapp: "WhatsApp", user: "Usuário", manager: "Gestor", admin: "Adm" };

const humanKey = (k: string) => LABELS[k] ?? k.replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").trim().replace(/^./, (c) => c.toUpperCase());

function humanValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "number") return v.toLocaleString("pt-BR");
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return fmtDateTime(v);
    return WORDS[v.toLowerCase()] ?? v;
  }
  if (Array.isArray(v)) return v.length ? v.map(humanValue).join(", ") : "nenhum";
  if (typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${humanKey(k)}: ${humanValue(x)}`).join(" · ");
  return String(v);
}

/** Transforma o JSON guardado no registro em pares legíveis ({"motivo":"Consulta de CNPJ"} → Motivo: Consulta de CNPJ). */
export function describeMeta(meta: unknown): { label: string; value: string }[] {
  if (!meta || typeof meta !== "object") return meta ? [{ label: "Detalhe", value: humanValue(meta) }] : [];
  return Object.entries(meta as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => ({ label: humanKey(k), value: humanValue(v) }));
}
