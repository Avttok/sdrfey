/** Lista Flow: filtros e palavras de cada segmento (sem banco: o navegador também usa). */
export type ListFilters = {
  ufs: string[];
  city: string;
  segments: string[];
  /** Palavras livres, separadas por vírgula (procura no nome e na atividade da empresa). */
  words: string;
  /** "grupo:chave" de tags (porte, capital…). Dentro do mesmo grupo vale "ou". */
  tags: string[];
  phone: boolean;
  email: boolean;
  person: boolean;
  enriched: "any" | "yes" | "no";
  untouched: boolean;
  /** Só empresas com situação cadastral ATIVA. */
  active: boolean;
  /** Só quem tem celular (11 dígitos), o que dá WhatsApp. */
  mobile: boolean;
  /** Tempo de abertura da empresa: nova (menos de 2 anos), média (2 a 10) ou antiga (mais de 10). */
  age: "any" | "new" | "mid" | "old";
  /** Sem nenhum contato há N dias (0 = não filtra). */
  quiet: 0 | 30 | 60 | 90;
  /** Como escolher os leads quando há mais do que cabem: sorteados, mais novos ou mais antigos no sistema. */
  order: "random" | "newest" | "oldest";
  /** Quantos leads reservar (10 a 100). */
  size: number;
  /** Aparência da carta da lista. */
  color: string;
  icon: string;
};
/** Limites do Lista Flow: no máximo 100 contatos por lista e 3 listas por pessoa (somando Prospecção e Vendas). */
export const LIST_MAX_LEADS = 100;
export const LIST_MAX_PER_USER = 3;
export const LIST_COLORS = ["#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#6366f1", "#0ea5e9", "#14b8a6", "#22c55e"];
export const LIST_ICON_KEYS = ["target", "flame", "phone", "star", "rocket", "truck", "wrench", "map", "gem", "zap"] as const;
export const EMPTY_FILTERS: ListFilters = { ufs: [], city: "", segments: [], words: "", tags: [], phone: true, email: false, person: false, enriched: "any", untouched: false, active: false, mobile: false, age: "any", quiet: 0, order: "random", size: LIST_MAX_LEADS, color: LIST_COLORS[0], icon: "target" };

export const SEGMENT_WORDS: Record<string, { label: string; words: string[] }> = {
  posto_molas: { label: "Posto de molas", words: ["mola", "feixe", "suspens"] },
  auto_center: { label: "Auto center", words: ["auto center", "autocenter", "centro automotivo", "auto centro", "mecanic", "mecânic"] },
  parafusos: { label: "Loja de parafusos", words: ["parafus", "fixador", "porca"] },
  ferramentas: { label: "Loja de ferramentas", words: ["ferrament"] },
  concessionaria: { label: "Concessionária", words: ["concession", "veículos", "veiculos"] },
  industria: { label: "Indústria", words: ["indústria", "industria", "metalurg", "usinagem"] },
  implementos: { label: "Implementos rodoviários", words: ["implement", "carreta", "reboque", "rodoviár", "rodoviar"] },
  auto_pecas: { label: "Auto peças", words: ["auto pe", "autope", "autopeç", "autopec", "peças para veículos", "pecas para veiculos"] },
};

export const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

/** Aceita qualquer coisa vinda do navegador ou do banco e devolve filtros válidos. */
export function cleanListFilters(raw: unknown): ListFilters {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const arr = (v: unknown, ok: (s: string) => boolean, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && ok(x)).slice(0, max) : []);
  return {
    ufs: arr(r.ufs, (s) => UFS.includes(s), 27),
    city: typeof r.city === "string" ? r.city.trim().slice(0, 60) : "",
    segments: arr(r.segments, (s) => s in SEGMENT_WORDS, 10),
    words: typeof r.words === "string" ? r.words.slice(0, 120) : "",
    tags: arr(r.tags, (s) => /^[\w]+:[\w-]+$/.test(s), 40),
    phone: r.phone === true, email: r.email === true, person: r.person === true,
    enriched: r.enriched === "yes" || r.enriched === "no" ? r.enriched : "any",
    untouched: r.untouched === true,
    active: r.active === true, mobile: r.mobile === true,
    age: r.age === "new" || r.age === "mid" || r.age === "old" ? r.age : "any",
    quiet: r.quiet === 30 || r.quiet === 60 || r.quiet === 90 ? r.quiet : 0,
    order: r.order === "newest" || r.order === "oldest" ? r.order : "random",
    size: typeof r.size === "number" && Number.isFinite(r.size) ? Math.min(LIST_MAX_LEADS, Math.max(10, Math.round(r.size))) : LIST_MAX_LEADS,
    color: typeof r.color === "string" && LIST_COLORS.includes(r.color) ? r.color : LIST_COLORS[0],
    icon: typeof r.icon === "string" && (LIST_ICON_KEYS as readonly string[]).includes(r.icon) ? r.icon : "target",
  };
}

export function describeFilters(f: ListFilters): string[] {
  const out: string[] = [];
  if (f.ufs.length) out.push(f.ufs.join(", "));
  if (f.city) out.push(f.city);
  if (f.segments.length) out.push(f.segments.map((s) => SEGMENT_WORDS[s].label).join(" + "));
  if (f.words.trim()) out.push(`“${f.words.trim()}”`);
  if (f.tags.length) out.push(`${f.tags.length} tag(s)`);
  const need = [f.phone && "telefone", f.email && "e-mail", f.person && "contato"].filter(Boolean);
  if (need.length) out.push(`com ${need.join(", ")}`);
  if (f.enriched !== "any") out.push(f.enriched === "yes" ? "consultados" : "não consultados");
  if (f.untouched) out.push("nunca contatados");
  if (f.quiet) out.push(`sem contato há ${f.quiet}+ dias`);
  if (f.active) out.push("só ATIVAS");
  if (f.mobile) out.push("com celular");
  if (f.age !== "any") out.push(f.age === "new" ? "empresas novas" : f.age === "mid" ? "2 a 10 anos" : "mais de 10 anos");
  if (f.size < LIST_MAX_LEADS) out.push(`${f.size} leads`);
  if (f.order !== "random") out.push(f.order === "newest" ? "mais novos primeiro" : "mais antigos primeiro");
  return out;
}
