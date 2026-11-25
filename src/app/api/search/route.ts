import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getCurrentUser } from "@/modules/auth/guard";
import { visibleNav } from "@/config/nav";
import { ADMIN_SECTIONS } from "@/config/admin-sections";
import { isSellerOnly } from "@/config/roles";
import { where as leadsWhere } from "@/modules/leads/list";
import { MARKER_BY_KEY, markerFromQuery } from "@/config/markers";
import { canAccessChannel, CHANNELS } from "@/modules/chat/channels";
import { visibleUsers } from "@/modules/auth/visibility";
import { ROLE_META, type Role } from "@/config/roles";

export const dynamic = "force-dynamic";

export type SearchKind = "page" | "admin" | "user" | "lead" | "person" | "visit" | "deal" | "task" | "chat" | "notif" | "product" | "tag" | "rep" | "carrier" | "email" | "script";
export type SearchHit = { kind: SearchKind; title: string; sub?: string; href: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Busca global. Só devolve o que o cargo e as permissões da pessoa permitem ver. */
export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword) return NextResponse.json({ hits: [] }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ hits: [] });
  const nq = norm(q), like = `%${q.replace(/[%_\\]/g, "")}%`, digits = q.replace(/\D/g, "");
  const can = (k: string) => me.isAdmin || !!me.permissions[k];
  const adminAll = me.isAdmin && me.adminView === "all";
  const hits: SearchHit[] = [];

  // Páginas e configurações (só as que a pessoa enxerga no menu; o painel do Adm só para o Adm)
  for (const n of visibleNav(me.permissions, me.isAdmin)) if (norm(`${n.label} ${n.group ?? ""}`).includes(nq)) hits.push({ kind: "page", title: n.label, sub: n.group ?? "Menu", href: n.href });
  if (adminAll) for (const s of ADMIN_SECTIONS) for (const i of s.items) if (norm(`${i.label} ${i.hint} ${s.title}`).includes(nq)) hits.push({ kind: "admin", title: i.label, sub: `Painel do Adm · ${s.title}`, href: i.href });

  const MINE: [string, string][] = [["Minha conta · Cor, tema e aparência", "tema cor accent fonte aparência escuro claro"], ["Minha conta · Foto e banner do perfil", "avatar foto banner perfil"], ["Minha conta · Senha", "senha trocar segurança"], ["Minha conta · Agente e ramal (discador)", "agente ramal discador vocall telefone"], ["Minha conta · Barra de menus", "menu barra ordem pastas"]];
  for (const [t, k] of MINE) if (norm(`${t} ${k}`).includes(nq)) hits.push({ kind: "page", title: t, sub: "Configurações", href: "/conta" });

  const jobs: Promise<void>[] = [];
  const run = (fn: () => Promise<void>) => jobs.push(fn().catch(() => undefined));

  /* marcadores: "site", "redes sociais", "sem celular", "site e instagram" mostram os leads que se encaixam */
  const mq = markerFromQuery(q);
  if (mq && can("tab.leads")) run(async () => {
    const label = [...mq.has.map((k) => MARKER_BY_KEY.get(k)?.label), ...mq.not.map((k) => `sem ${MARKER_BY_KEY.get(k)?.label}`)].join(" + ");
    const params = new URLSearchParams();
    for (const k of mq.has) params.append("tag", `marcador:${k}`);
    for (const k of mq.not) params.append("sem", k);
    const f = { q: "", tags: mq.has.map((k) => `marcador:${k}`), sem: mq.not, page: 1, sellerScope: isSellerOnly(me.roles) ? me.id : undefined };
    const r = await db.execute<{ id: number; company: string; city: string | null; uf: string | null; total: number }>(sql`select id, company, city, uf, count(*) over()::int as total from leads where ${leadsWhere(f)} order by company limit 6`);
    hits.push({ kind: "page", title: `Leads: ${label}`, sub: `Marcador · ${r[0]?.total ?? 0} lead${(r[0]?.total ?? 0) === 1 ? "" : "s"} · abrir a lista filtrada`, href: `/leads?${params}` });
    for (const x of r) hits.push({ kind: "lead", title: x.company, sub: [[x.city, x.uf].filter(Boolean).join("/"), label].filter(Boolean).join(" · "), href: `/leads/${x.id}` });
  });
  if (can("tab.leads")) run(async () => {
    const f = { q, tags: [] as string[], page: 1, sellerScope: isSellerOnly(me.roles) ? me.id : undefined };
    const r = await db.execute<{ id: number; company: string; trade_name: string | null; city: string | null; uf: string | null }>(sql`select id, company, trade_name, city, uf from leads where ${leadsWhere(f)} order by company limit 6`);
    for (const x of r) hits.push({ kind: "lead", title: x.company, sub: [x.trade_name && x.trade_name !== x.company ? x.trade_name : null, [x.city, x.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ") || "Lead", href: `/leads/${x.id}` });
  });
  if (can("tab.leads")) run(async () => {
    const r = await db.execute<{ lead_id: number; name: string; role_title: string | null; company: string }>(sql`select p.lead_id, p.name, p.role_title, l.company from lead_people p join leads l on l.id = p.lead_id where l.is_test = false and (p.name ilike ${like} ${digits.length >= 4 ? sql`or exists (select 1 from lead_channels c where c.person_id = p.id and c.value like ${`%${digits}%`})` : sql``}) order by p.name limit 5`);
    for (const x of r) hits.push({ kind: "person", title: x.name, sub: [x.role_title, x.company].filter(Boolean).join(" · "), href: `/leads/${x.lead_id}` });
  });
  if (can("tab.visitas")) run(async () => {
    const r = await db.execute<{ id: number; code: string; visit_date: string | null; company: string; lead_id: number }>(sql`select v.id, v.code, v.visit_date, v.lead_id, l.company from visits v join leads l on l.id = v.lead_id where l.is_test = false and (v.code ilike ${like} or l.company ilike ${like} or v.note ilike ${like}) order by v.created_at desc limit 5`);
    for (const x of r) hits.push({ kind: "visit", title: `Visita ${x.code}`, sub: [x.company, x.visit_date].filter(Boolean).join(" · "), href: `/leads/${x.lead_id}` });
  });
  if (can("tab.negociacoes")) run(async () => {
    const seller = isSellerOnly(me.roles) ? sql`and (d.seller_id = ${me.id} or d.seller_id is null)` : sql``;
    const r = await db.execute<{ lead_id: number; stage: string; company: string }>(sql`select d.lead_id, d.stage, l.company from deals d join leads l on l.id = d.lead_id where l.is_test = false ${seller} and (l.company ilike ${like} or l.trade_name ilike ${like}) order by d.created_at desc limit 5`);
    for (const x of r) hits.push({ kind: "deal", title: x.company, sub: `Negociação · ${x.stage}`, href: `/leads/${x.lead_id}` });
  });
  if (can("tab.representantes")) run(async () => {
    const r = await db.execute<{ rep_name: string | null; sap_code: string; city: string | null; uf: string | null }>(sql`select rep_name, sap_code, city, uf from reps where rep_name ilike ${like} or sap_code ilike ${like} or city ilike ${like} order by rep_name limit 4`);
    for (const x of r) hits.push({ kind: "rep", title: x.rep_name ?? x.sap_code, sub: [x.sap_code, [x.city, x.uf].filter(Boolean).join("/")].filter(Boolean).join(" · "), href: `/representantes?q=${encodeURIComponent(x.sap_code)}` });
  });
  if (can("tab.transportadoras")) run(async () => {
    const r = await db.execute<{ name: string; uf: string }>(sql`select distinct name, uf from carriers where name ilike ${like} order by name limit 4`);
    for (const x of r) hits.push({ kind: "carrier", title: x.name, sub: `Transportadora · ${x.uf}`, href: "/transportadoras" });
  });
  if (can("tab.email")) run(async () => {
    const r = await db.execute<{ name: string; subject: string }>(sql`select name, subject from email_templates where active = true and (owner_id is null or owner_id = ${me.id}) and (name ilike ${like} or subject ilike ${like}) order by name limit 4`);
    for (const x of r) hits.push({ kind: "email", title: x.name, sub: x.subject, href: "/email" });
  });
  if (can("tab.scripts")) run(async () => {
    const r = await db.execute<{ id: number; title: string; summary: string | null }>(sql`select id, title, summary from scripts where active = true and (owner_id is null or owner_id = ${me.id}) and (title ilike ${like} or summary ilike ${like}) order by title limit 4`);
    for (const x of r) hits.push({ kind: "script", title: x.title, sub: x.summary ?? "Roteiro", href: "/scripts" });
  });
  run(async () => {
    const r = await db.execute<{ id: number; name: string; username: string; roles: string[] }>(sql`select id, name, username, roles from users where active = true and (name ilike ${like} or username ilike ${like}) and ${visibleUsers(me) ?? sql`true`} order by name limit 5`);
    for (const x of r) hits.push({ kind: "user", title: x.name, sub: `@${x.username} · ${x.roles.filter((k) => k !== "admin" || me.isAdmin).map((k) => ROLE_META[k as Role]?.label ?? k).join(", ")}`, href: adminAll ? "/admin/usuarios" : "chat:dm" });
  });
  if (can("chat.use")) run(async () => {
    const r = await db.execute<{ channel: string; body: string; at: string; name: string | null }>(sql`select m.channel, m.body, m.created_at as at, u.name from chat_messages m left join users u on u.id = m.user_id where m.deleted_at is null and m.body ilike ${like} order by m.id desc limit 60`);
    let n = 0;
    for (const x of r) {
      if (n >= 5) break;
      if (!canAccessChannel({ id: me.id, roles: me.roles }, x.channel)) continue;
      n++;
      const label = x.channel.startsWith("dm:") ? "Conversa privada" : CHANNELS.find((c) => c.key === x.channel)?.label ?? x.channel;
      hits.push({ kind: "chat", title: x.body.slice(0, 90), sub: `${x.name ?? "Conta removida"} · ${label}`, href: `chat:${x.channel}` });
    }
  });
  run(async () => {
    const r = await db.execute<{ title: string; note: string | null; lead_id: number | null; done: boolean }>(sql`select title, note, lead_id, done_at is not null as done from tasks where user_id = ${me.id} and (title ilike ${like} or note ilike ${like}) order by done_at is not null, due_at nulls last limit 5`);
    for (const x of r) hits.push({ kind: "task", title: x.title, sub: x.done ? "Tarefa concluída" : "Tarefa", href: x.lead_id ? `/leads/${x.lead_id}` : "/tarefas" });
  });
  run(async () => {
    const r = await db.execute<{ title: string; body: string | null; href: string | null }>(sql`select title, body, href from notifications where user_id = ${me.id} and (title ilike ${like} or body ilike ${like}) order by id desc limit 4`);
    for (const x of r) hits.push({ kind: "notif", title: x.title, sub: x.body ?? "Notificação", href: x.href ?? "/painel" });
  });
  if (can("tab.negociacoes") || adminAll) run(async () => {
    const r = await db.execute<{ code: string; description: string }>(sql`select code, description from products where code ilike ${like} or description ilike ${like} order by description limit 4`);
    for (const x of r) hits.push({ kind: "product", title: x.description, sub: `Produto · ${x.code}`, href: adminAll ? "/admin/vendas" : "/negociacoes" });
  });
  if (adminAll) run(async () => {
    const r = await db.execute<{ label: string; group_key: string }>(sql`select label, group_key from tags where label ilike ${like} order by label limit 4`);
    for (const x of r) hits.push({ kind: "tag", title: x.label, sub: `Tag · ${x.group_key}`, href: "/admin/tags" });
  });
  await Promise.all(jobs);

  const order: SearchKind[] = ["page", "admin", "user", "lead", "person", "deal", "visit", "task", "chat", "notif", "product", "tag", "rep", "carrier", "email", "script"];
  hits.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return NextResponse.json({ hits: hits.slice(0, 60) }, { headers: { "Cache-Control": "no-store" } });
}
