import { and, asc, eq, inArray } from "drizzle-orm";
import { db, users } from "@/db";
import { dayStart } from "@/lib/format";
import type { CurrentUser } from "@/modules/auth/guard";
import { visibleUsers } from "@/modules/auth/visibility";
import { SECTIONS, type Group, type Kind, type ReportParams } from "./report";

export const permFor = (kind: Kind) => (kind === "sdr" ? "tab.desempenho" : "tab.desempenho_vendas");

/** Pessoas que esta conta pode incluir: só ela mesma, ou a equipe inteira com a permissão "desempenho.equipe". */
export async function allowedPeople(me: CurrentUser, kind: Kind): Promise<{ id: number; name: string }[]> {
  if (!me.permissions["desempenho.equipe"]) return [{ id: me.id, name: me.name }];
  const roles = kind === "sdr" ? ["user", "manager", "admin"] : ["seller", "manager", "admin"];
  const rows = await db.select({ id: users.id, name: users.name, roles: users.roles }).from(users).where(and(eq(users.active, true), visibleUsers(me))).orderBy(asc(users.name));
  const ok = rows.filter((r) => r.roles.some((x) => roles.includes(x)) || r.id === me.id);
  return ok.map((r) => ({ id: r.id, name: r.name }));
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Valida tudo que vem da tela/URL. Nunca confia nos números de pessoas: filtra pelas permitidas. */
export async function parseParams(me: CurrentUser, kind: Kind, raw: { from?: unknown; to?: unknown; sections?: unknown; users?: unknown; group?: unknown }): Promise<{ params: ReportParams; names: Record<number, string> } | { error: string }> {
  if (!me.permissions[permFor(kind)]) return { error: "Sem permissão" };
  const from = String(raw.from ?? ""), to = String(raw.to ?? "");
  if (!ISO.test(from) || !ISO.test(to) || Number.isNaN(dayStart(from).getTime()) || Number.isNaN(dayStart(to).getTime())) return { error: "Datas inválidas" };
  if (from > to) return { error: "A data inicial é depois da final" };
  if ((dayStart(to).getTime() - dayStart(from).getTime()) / 864e5 > 800) return { error: "Período grande demais (máximo ~2 anos)" };
  const list = (v: unknown) => (Array.isArray(v) ? v : String(v ?? "").split(",")).map((s) => String(s).trim()).filter(Boolean);
  const valid = new Set(SECTIONS[kind].map((s) => s.id));
  const sections = list(raw.sections).filter((s) => valid.has(s));
  if (!sections.length) return { error: "Escolha ao menos um conteúdo" };
  const allowed = await allowedPeople(me, kind);
  const want = list(raw.users).map(Number).filter(Number.isInteger);
  const ids = want.length ? allowed.filter((a) => want.includes(a.id)).map((a) => a.id) : allowed.map((a) => a.id);
  if (!ids.length) return { error: "Escolha ao menos uma pessoa" };
  const g = String(raw.group ?? "dia");
  const group: Group = g === "semana" || g === "mes" ? g : "dia";
  const names = Object.fromEntries(allowed.map((a) => [a.id, a.name]));
  void inArray;
  return { params: { kind, from, to, sections, users: ids, group }, names };
}
