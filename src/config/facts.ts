/** Campos de fábrica que o atendimento preenche. O Adm cria outros em Admin › Dados dos leads. */
export type FieldKind = "lista" | "multi" | "texto" | "numero" | "simnao";
export type FieldScope = "lead" | "person";
export type FieldDefView = { key: string; label: string; kind: FieldKind; options: string[]; scope: FieldScope; groupName: string; ttlDays: number | null; priority: number; active: boolean };
type Seed = Omit<FieldDefView, "active">;

export const FIELD_KINDS: Record<FieldKind, string> = { lista: "Escolher uma opção", multi: "Escolher várias", texto: "Texto curto", numero: "Número", simnao: "Sim ou não" };
export const FIELD_GROUPS = ["Perfil de compra", "Situação", "Contato", "Telefonia", "Outros"] as const;

export const FIELD_SEED: Seed[] = [
  { key: "aplicacao", label: "Onde aplica os itens", kind: "multi", scope: "lead", groupName: "Perfil de compra", ttlDays: 365, priority: 90, options: ["Balcão e varejo", "Oficinas e frotas", "Montagem do produto final", "Manutenção das máquinas", "Manutenção da própria frota", "Serviço para clientes", "Revenda para outras empresas", "Indústrias e construtoras", "Reposição e estoque", "Reposição e assistência técnica", "Mais de uma aplicação"] },
  { key: "mix", label: "Mix de produtos", kind: "lista", scope: "lead", groupName: "Perfil de compra", ttlDays: 365, priority: 85, options: ["Mix variado de itens", "Poucos itens específicos", "Só um item"] },
  { key: "frequencia", label: "Frequência de compra", kind: "lista", scope: "lead", groupName: "Perfil de compra", ttlDays: 180, priority: 80, options: ["Toda semana", "Todo mês", "A cada dois ou três meses", "Só quando precisa"] },
  { key: "porte", label: "Tamanho da empresa", kind: "lista", scope: "lead", groupName: "Perfil de compra", ttlDays: 365, priority: 70, options: ["Até 5 funcionários", "6 a 20", "21 a 100", "Mais de 100"] },
  { key: "volume", label: "Volume mensal de compra", kind: "lista", scope: "lead", groupName: "Perfil de compra", ttlDays: 180, priority: 75, options: ["Até R$ 2 mil", "R$ 2 a 10 mil", "R$ 10 a 50 mil", "Mais de R$ 50 mil"] },
  { key: "fornecedor", label: "Fornecedor atual", kind: "texto", scope: "lead", groupName: "Situação", ttlDays: 180, priority: 72, options: [] },
  { key: "quando", label: "Quando precisa comprar", kind: "lista", scope: "lead", groupName: "Situação", ttlDays: 60, priority: 78, options: ["Agora", "Nos próximos 30 dias", "De 1 a 3 meses", "Sem previsão"] },
  { key: "decisor", label: "Quem decide a compra", kind: "lista", scope: "lead", groupName: "Situação", ttlDays: 365, priority: 68, options: ["O dono", "O comprador", "A engenharia ou manutenção", "Compras de outra unidade"] },
  { key: "ja_cliente", label: "Já comprou da Fey", kind: "lista", scope: "lead", groupName: "Situação", ttlDays: 365, priority: 66, options: ["É ou já foi cliente", "Compra por um distribuidor", "Nunca comprou"] },
  { key: "atendimento", label: "Como o telefone atende", kind: "lista", scope: "lead", groupName: "Telefonia", ttlDays: 120, priority: 60, options: ["Atende uma pessoa", "URA (menu automático)", "Caixa postal", "Número errado ou fora de serviço"] },
  { key: "canal_preferido", label: "Canal preferido", kind: "lista", scope: "person", groupName: "Contato", ttlDays: 365, priority: 64, options: ["WhatsApp", "Ligação", "E-mail"] },
  { key: "melhor_horario", label: "Melhor horário para falar", kind: "lista", scope: "person", groupName: "Contato", ttlDays: 365, priority: 62, options: ["De manhã", "Na hora do almoço", "À tarde", "No fim do dia"] },
  { key: "papel", label: "Papel na compra", kind: "lista", scope: "person", groupName: "Contato", ttlDays: null, priority: 58, options: ["Portaria", "Secretaria", "Comprador", "Dono ou sócio", "Engenharia ou manutenção", "Outro"] },
];

export const FIELD_SEED_BY_KEY = new Map(FIELD_SEED.map((f) => [f.key, f]));

/** Chave de campo válida (a mesma regra vale no roteiro). */
export const FIELD_KEY_RE = /^[a-z][a-z0-9_]{1,30}$/;

/** Dado velho: passou do prazo do campo desde a última confirmação. */
export function isStale(ttlDays: number | null, lastAt: string | Date): boolean {
  if (!ttlDays) return false;
  return Date.now() - new Date(lastAt).getTime() > ttlDays * 86_400_000;
}

/** Nome da chave a partir de um rótulo ("Frota própria" → "frota_propria"). */
export function keyFromLabel(label: string): string {
  const k = label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30);
  return /^[a-z]/.test(k) ? k : `c_${k}`.slice(0, 30);
}

/** Uma resposta guardada, como a tela recebe. */
export type FactView = { key: string; value: string; confidence: 1 | 2 | 3; at: string; personId: number | null; by: string | null };
export const CONFIDENCE: Record<number, { label: string; hint: string }> = {
  1: { label: "Informado", hint: "Disseram uma vez" },
  2: { label: "Confirmado", hint: "Confirmado numa segunda ligação" },
  3: { label: "Firme", hint: "Confirmado em várias ligações" },
};

/** Separador dos itens de um campo de várias escolhas. */
export const MULTI_SEP = " | ";
export const splitMulti = (v: string) => v.split(MULTI_SEP).map((x) => x.trim()).filter(Boolean);

/** Confere o valor de acordo com o tipo do campo. Devolve o valor limpo ou null se for inválido. */
export function cleanValue(def: Pick<FieldDefView, "kind" | "options">, raw: string): string | null {
  const v = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!v || v.length > 200) return null;
  if (def.kind === "lista") return def.options.includes(v) || v.length <= 60 ? v : null;
  if (def.kind === "multi") { const items = splitMulti(v).filter((x) => x.length <= 60); return items.length && items.length <= 8 ? [...new Set(items)].join(MULTI_SEP) : null; }
  if (def.kind === "simnao") return v === "Sim" || v === "Não" ? v : null;
  if (def.kind === "numero") { const n = Number(v.replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? String(n) : null; }
  return v.slice(0, 120);
}

/** Campos que ainda faltam (ou venceram) para este lead, os mais valiosos primeiro. */
export function missingFields(defs: FieldDefView[], facts: FactView[], goalIsSales = false, limit = 4): { def: FieldDefView; why: "falta" | "velho" }[] {
  const out: { def: FieldDefView; why: "falta" | "velho"; score: number }[] = [];
  for (const d of defs) {
    if (!d.active || d.scope !== "lead") continue;
    const f = facts.find((x) => x.key === d.key && x.personId === null);
    if (!f) out.push({ def: d, why: "falta", score: d.priority + (goalIsSales && ["quando", "volume", "fornecedor"].includes(d.key) ? 8 : 0) });
    else if (isStale(d.ttlDays, f.at)) out.push({ def: d, why: "velho", score: d.priority - 15 });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit).map(({ def, why }) => ({ def, why }));
}
