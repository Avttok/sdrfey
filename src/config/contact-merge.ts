/** Juntar contatos repetidos: regras puras (o navegador e o servidor usam as mesmas). */
export type DupPerson = { id: number; name: string; roleTitle: string | null; phones: string[]; emails: string[]; facts: number };
export type DupSet = {
  leadId: number; company: string;
  /** por que parecem a mesma pessoa */ reasons: ("telefone" | "email" | "nome" | "nome parecido")[];
  /** certeza: mesmo telefone, e-mail ou nome igual. "Nome parecido" (um começa com o outro) pede conferência. */ sure: boolean;
  people: DupPerson[];
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
export const channelsOf = (p: DupPerson) => p.phones.length + p.emails.length;

/** Quem deve ficar. Com a preferência ligada, quem tem telefone ou e-mail sempre vence; depois, o que tem mais dados e o nome mais completo. */
export function pickKeeper(people: DupPerson[], preferContact: boolean): number {
  const score = (p: DupPerson) => (preferContact ? channelsOf(p) * 1000 : 0) + p.facts * 10 + Math.min(norm(p.name).length, 60) + (p.roleTitle ? 5 : 0) + (preferContact ? 0 : channelsOf(p));
  return [...people].sort((a, b) => score(b) - score(a) || a.id - b.id)[0].id;
}

/** O que a pessoa que fica terá depois de juntar (sem repetir telefone e e-mail). */
export function afterMerge(people: DupPerson[]) {
  return { phones: new Set(people.flatMap((p) => p.phones)).size, emails: new Set(people.flatMap((p) => p.emails)).size, facts: people.reduce((a, p) => a + p.facts, 0) };
}

/** Agrupa, dentro de cada empresa, as pessoas que parecem ser a mesma (ligadas por telefone, e-mail ou nome). Cada conjunto vira um cartão. */
export function findSets(groups: { leadId: number; company: string; people: DupPerson[] }[]): DupSet[] {
  const out: DupSet[] = [];
  for (const g of groups) {
    const parent = new Map<number, number>(g.people.map((p) => [p.id, p.id]));
    const find = (x: number): number => { let r = x; while (parent.get(r) !== r) r = parent.get(r)!; parent.set(x, r); return r; };
    const why = new Map<number, Set<DupSet["reasons"][number]>>();
    const link = (a: DupPerson, b: DupPerson, r: DupSet["reasons"][number]) => { parent.set(find(a.id), find(b.id)); for (const k of [a.id, b.id]) { const s = why.get(k) ?? new Set(); s.add(r); why.set(k, s); } };
    for (const a of g.people) for (const b of g.people) {
      if (a.id >= b.id) continue;
      const na = norm(a.name), nb = norm(b.name);
      if (a.phones.some((x) => b.phones.includes(x))) link(a, b, "telefone");
      if (a.emails.some((x) => b.emails.includes(x))) link(a, b, "email");
      if (na && na === nb) link(a, b, "nome");
      else if (na.length > 3 && nb.length > 3 && (na.startsWith(nb + " ") || nb.startsWith(na + " "))) link(a, b, "nome parecido");
    }
    const sets = new Map<number, DupPerson[]>();
    for (const p of g.people) { if (!why.has(p.id)) continue; const r = find(p.id); sets.set(r, [...(sets.get(r) ?? []), p]); }
    for (const people of sets.values()) {
      const reasons = [...new Set(people.flatMap((p) => [...(why.get(p.id) ?? [])]))] as DupSet["reasons"];
      out.push({ leadId: g.leadId, company: g.company, reasons, sure: reasons.some((r) => r !== "nome parecido"), people });
    }
  }
  return out;
}
