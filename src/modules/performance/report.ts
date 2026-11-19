import { sql } from "drizzle-orm";
import { db } from "@/db";
import { TZ, dayEnd, dayStart, fmtDuration } from "@/lib/format";
import { getDashboard, getDashboardExtra, periodDays, type Period } from "@/modules/dashboard/stats";
import { getSalesStats } from "@/modules/deals/stats";
import { soldCents, closedDay } from "@/modules/deals/goals";
import { getSettings } from "@/modules/settings/get";
import { STAGE_META } from "@/config/deals";

export type Kind = "sdr" | "vendas";
export type Group = "dia" | "semana" | "mes";
export type ReportParams = { kind: Kind; from: string; to: string; sections: string[]; users: number[]; group: Group };

/** Uma aba da planilha. `fmt` diz como formatar a coluna no Excel. */
export type Col = { header: string; key: string; width: number; fmt?: "text" | "int" | "brl" | "pct" | "date" | "datetime" | "dec" };
export type Sheet = { id: string; name: string; cols: Col[]; rows: Record<string, string | number | null>[] };
export type Report = { title: string; subtitle: string; people: string[]; summary: { label: string; value: string; hint?: string }[]; sheets: Sheet[] };

export const SECTIONS: Record<Kind, { id: string; label: string; hint: string }[]> = {
  sdr: [
    { id: "resumo", label: "Resumo do período", hint: "Todos os indicadores principais numa aba só" },
    { id: "diario", label: "Evolução (por dia, semana ou mês)", hint: "Atendidos, ligações, WhatsApp, e-mails e agendados" },
    { id: "horas", label: "Atividade por hora", hint: "Em que horários você mais atende" },
    { id: "meios", label: "Meios de contato", hint: "Quantos contatos por meio e quantos qualificaram" },
    { id: "atendimentos", label: "Todos os atendimentos", hint: "Lead por lead: empresa, resultado, tempo e tags" },
    { id: "visitas", label: "Visitas agendadas", hint: "Código, empresa, data, representante e andamento" },
    { id: "pessoas", label: "Quadro por pessoa", hint: "Comparativo entre as pessoas escolhidas (equipe)" },
  ],
  vendas: [
    { id: "resumo", label: "Resumo do período", hint: "Vendas, conversão, ticket, ciclo e mais" },
    { id: "diario", label: "Vendas e contatos (por dia, semana ou mês)", hint: "Valor vendido, vendas e contatos no tempo" },
    { id: "funil", label: "Funil de negociações", hint: "Quantas negociações e quanto dinheiro em cada etapa" },
    { id: "negociacoes", label: "Todas as negociações", hint: "Negócio por negócio: etapa, valor, datas e responsáveis" },
    { id: "cotacoes", label: "Cotações enviadas", hint: "Data, cliente e valor de cada cotação" },
    { id: "visitas", label: "Visitas dos vendedores", hint: "Visitas ligadas às suas negociações" },
    { id: "pessoas", label: "Quadro por vendedor", hint: "Comparativo entre vendedores (equipe)" },
  ],
};

const ids = (list: number[]) => sql.join((list.length ? list : [-1]).map((i) => sql`${i}`), sql`, `);
const bucket = (col: ReturnType<typeof sql>, g: Group) => sql`to_char(date_trunc(${sql.raw(`'${g === "dia" ? "day" : g === "semana" ? "week" : "month"}'`)}, ${col} at time zone ${TZ}), 'YYYY-MM-DD')`;
const label = (g: Group, d: string) => { const [y, m, dd] = d.split("-"); return g === "mes" ? `${m}/${y}` : g === "semana" ? `Semana de ${dd}/${m}/${y}` : `${dd}/${m}/${y}`; };
const brl = (cents: number) => Math.round(cents) / 100;
const nfp = (a: number, b: number) => (b ? a / b : 0);
const d2 = (v: unknown) => (v == null ? null : new Date(v as string).toISOString());

export const periodOf = (from: string, to: string): Period => ({ from, to, preset: "custom" });

export async function buildReport(p: ReportParams, personNames: Record<number, string>): Promise<Report> {
  const period = periodOf(p.from, p.to);
  const days = periodDays(period);
  const from = sql`${dayStart(p.from).toISOString()}::timestamptz`;
  const to = sql`${dayEnd(p.to).toISOString()}::timestamptz`;
  const U = ids(p.users);
  const want = new Set(p.sections);
  const sheets: Sheet[] = [];
  const people = p.users.map((i) => personNames[i]).filter(Boolean);
  const range = `${p.from.split("-").reverse().join("/")} a ${p.to.split("-").reverse().join("/")}`;
  const summary: Report["summary"] = [];

  if (p.kind === "sdr") {
    const settings = await getSettings();
    const [d, x] = await Promise.all([getDashboard(period, p.users, settings), getDashboardExtra(period, p.users)]);
    const peak = d.hours.length ? Object.entries(d.hours.reduce<Record<number, number>>((a, h) => ({ ...a, [h.h]: (a[h.h] ?? 0) + h.n }), {})).sort((a, b) => b[1] - a[1])[0]?.[0] : null;
    const base: [string, string | number, string?, Col["fmt"]?][] = [
      ["Atendidos", d.contacts, `${(d.contacts / days).toFixed(1).replace(".", ",")} por dia`, "int"],
      ["Qualificados", d.qualified, "leads que ficaram Qualificado", "int"],
      ["Taxa de qualificação", nfp(d.qualified, d.contacts), "qualificados ÷ atendidos", "pct"],
      ["Agendados (visitas)", d.scheduled, "visitas marcadas", "int"],
      ["Taxa de agendamento", nfp(d.scheduled, d.contacts), "agendados ÷ atendidos", "pct"],
      ["Ligações", d.calls, `${Math.round(nfp(d.calls, d.contacts) * 100)}% dos atendidos`, "int"],
      ["Conversando", d.conversing, "em conversa com o cliente", "int"],
      ["Convertidos", d.converted, "repassados aos vendedores", "int"],
      ["Vendas originadas", x.originated, x.originatedValue ? `R$ ${brl(x.originatedValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "faturadas", "int"],
      ["Descartados", x.discarded, "leads tirados da lista", "int"],
      ["Pulados", x.skipped, "", "int"],
      ["Parados", x.released, "", "int"],
      ["Visitas confirmadas", x.visitsConfirmed, "", "int"],
      ["Visitas realizadas", x.visitsDone, "", "int"],
      ["Visitas aguardando", x.visitsPending, "", "int"],
      ["Tempo médio por lead", fmtDuration(d.avgSeconds), `mediana ${fmtDuration(d.medianSeconds)}`, "text"],
      ["Tempo total atendendo", fmtDuration(x.totalSeconds), "somando todos os leads", "text"],
      ["Horário de pico", peak ? `${peak}h` : "—", "mais atendimentos", "text"],
      ["Dias com atendimento", x.daily.filter((q) => q.n > 0).length, `de ${days} dias`, "int"],
    ];
    for (const [l, v, h] of base.slice(0, 6)) summary.push({ label: l, value: typeof v === "number" && l.startsWith("Taxa") ? `${Math.round(v * 100)}%` : String(v), hint: h });
    if (want.has("resumo")) sheets.push({ id: "resumo", name: "Resumo", cols: [{ header: "Indicador", key: "k", width: 30 }, { header: "Valor", key: "v", width: 18, fmt: "text" }, { header: "Observação", key: "o", width: 44 }], rows: base.map(([k, v, o, f]) => ({ k, v: f === "pct" ? `${Math.round((v as number) * 100)}%` : v, o: o ?? "" })) });

    if (want.has("diario")) {
      const r = await db.execute<{ b: string; att: number; q: number; calls: number; wa: number; em: number; sched: number }>(sql`
        with a as (select ${bucket(sql`s.saved_at`, p.group)} as b, count(*)::int as att from attendance_sessions s where s.outcome = 'saved' and not s.is_test and s.user_id in (${U}) and s.saved_at between ${from} and ${to} group by 1),
        i as (select ${bucket(sql`i.at`, p.group)} as b, count(*) filter (where i.channel = 'ligacao')::int as calls, count(*) filter (where i.channel = 'whatsapp')::int as wa, count(*) filter (where i.channel = 'email')::int as em from interactions i where not i.is_test and i.user_id in (${U}) and i.at between ${from} and ${to} group by 1),
        v as (select ${bucket(sql`v.created_at`, p.group)} as b, count(*)::int as sched from visits v join leads l on l.id = v.lead_id where not l.is_test and v.canceled_at is null and v.user_id in (${U}) and v.created_at between ${from} and ${to} group by 1)
        select coalesce(a.b, i.b, v.b) as b, coalesce(a.att,0) as att, 0 as q, coalesce(i.calls,0) as calls, coalesce(i.wa,0) as wa, coalesce(i.em,0) as em, coalesce(v.sched,0) as sched
        from a full join i on i.b = a.b full join v on v.b = coalesce(a.b, i.b) order by 1`);
      sheets.push({ id: "diario", name: p.group === "dia" ? "Por dia" : p.group === "semana" ? "Por semana" : "Por mês", cols: [{ header: p.group === "dia" ? "Dia" : p.group === "semana" ? "Semana" : "Mês", key: "b", width: 22 }, { header: "Atendidos", key: "att", width: 12, fmt: "int" }, { header: "Ligações", key: "calls", width: 12, fmt: "int" }, { header: "WhatsApp", key: "wa", width: 12, fmt: "int" }, { header: "E-mails", key: "em", width: 12, fmt: "int" }, { header: "Agendados", key: "sched", width: 12, fmt: "int" }], rows: r.map((x) => ({ ...x, b: label(p.group, x.b) })) });
    }
    if (want.has("horas")) {
      const tot = new Map<number, number>(); for (const h of d.hours) tot.set(h.h, (tot.get(h.h) ?? 0) + h.n);
      const sum = [...tot.values()].reduce((a, b) => a + b, 0);
      sheets.push({ id: "horas", name: "Por hora", cols: [{ header: "Hora", key: "h", width: 10 }, { header: "Atendidos", key: "n", width: 12, fmt: "int" }, { header: "% do total", key: "p", width: 12, fmt: "pct" }], rows: [...tot.entries()].sort((a, b) => a[0] - b[0]).map(([h, n]) => ({ h: `${String(h).padStart(2, "0")}h`, n, p: nfp(n, sum) })) });
    }
    if (want.has("meios")) sheets.push({ id: "meios", name: "Meios de contato", cols: [{ header: "Meio", key: "l", width: 20 }, { header: "Contatos", key: "n", width: 12, fmt: "int" }, { header: "Qualificaram", key: "q", width: 14, fmt: "int" }, { header: "% qualificação", key: "p", width: 16, fmt: "pct" }], rows: d.meios.map((m) => ({ l: m.label, n: m.n, q: m.q, p: nfp(m.q, m.n) })) });
    if (want.has("atendimentos")) {
      const r = await db.execute<{ at: Date; who: string; company: string; cnpj: string; city: string | null; uf: string | null; secs: number | null; tags: string | null; ch: string | null }>(sql`
        select s.saved_at as at, u.name as who, l.company, l.cnpj, l.city, l.uf,
          extract(epoch from (s.saved_at - coalesce(s.started_at, s.shown_at)))::float as secs,
          (select string_agg(t.label, ', ' order by t.sort) from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = l.id and t.group_key in ('temperatura','qualificacao','situacao','agenda')) as tags,
          (select string_agg(distinct i.channel, ', ') from interactions i where i.lead_id = l.id and i.user_id = s.user_id and i.at between coalesce(s.started_at, s.shown_at) and s.saved_at + interval '2 minutes') as ch
        from attendance_sessions s join leads l on l.id = s.lead_id join users u on u.id = s.user_id
        where s.outcome = 'saved' and not s.is_test and s.user_id in (${U}) and s.saved_at between ${from} and ${to} order by s.saved_at desc limit 20000`);
      sheets.push({ id: "atendimentos", name: "Atendimentos", cols: [{ header: "Data e hora", key: "at", width: 20, fmt: "datetime" }, { header: "SDR", key: "who", width: 20 }, { header: "Empresa", key: "company", width: 38 }, { header: "CNPJ", key: "cnpj", width: 20 }, { header: "Cidade", key: "city", width: 20 }, { header: "UF", key: "uf", width: 6 }, { header: "Duração", key: "dur", width: 11 }, { header: "Meios usados", key: "ch", width: 24 }, { header: "Resultado (tags)", key: "tags", width: 44 }], rows: r.map((x) => ({ at: d2(x.at), who: x.who, company: x.company, cnpj: x.cnpj, city: x.city, uf: x.uf, dur: fmtDuration(x.secs), ch: x.ch, tags: x.tags })) });
    }
    if (want.has("visitas")) {
      const r = await db.execute<{ code: string; company: string; city: string | null; uf: string | null; vd: string | null; status: string; rep: string | null; km: number | null; who: string | null; at: Date }>(sql`
        select v.code, l.company, l.city, l.uf, v.visit_date::text as vd, v.status, v.rep_name as rep, v.rep_km as km, u.name as who, v.created_at as at
        from visits v join leads l on l.id = v.lead_id left join users u on u.id = v.user_id
        where not l.is_test and v.canceled_at is null and v.user_id in (${U}) and v.created_at between ${from} and ${to} order by v.created_at desc limit 20000`);
      sheets.push({ id: "visitas", name: "Visitas", cols: [{ header: "Código", key: "code", width: 12 }, { header: "Empresa", key: "company", width: 38 }, { header: "Cidade", key: "city", width: 20 }, { header: "UF", key: "uf", width: 6 }, { header: "Data da visita", key: "vd", width: 14, fmt: "date" }, { header: "Andamento", key: "status", width: 14 }, { header: "Representante", key: "rep", width: 28 }, { header: "Distância (km)", key: "km", width: 14, fmt: "int" }, { header: "Agendada por", key: "who", width: 20 }, { header: "Agendada em", key: "at", width: 20, fmt: "datetime" }], rows: r.map((x) => ({ ...x, at: d2(x.at), status: { pendente: "Aguardando", confirmada: "Confirmada", realizada: "Realizada" }[x.status] ?? x.status })) });
    }
    if (want.has("pessoas")) {
      const r = await db.execute<{ name: string; att: number; q: number; calls: number; sched: number; conv: number; secs: number | null }>(sql`
        select u.name,
          (select count(*)::int from attendance_sessions s where s.user_id = u.id and s.outcome = 'saved' and not s.is_test and s.saved_at between ${from} and ${to}) as att,
          (select count(distinct s.lead_id)::int from attendance_sessions s join lead_tags lt on lt.lead_id = s.lead_id join tags t on t.id = lt.tag_id and t.key = 'qualificado' where s.user_id = u.id and s.outcome = 'saved' and not s.is_test and s.saved_at between ${from} and ${to}) as q,
          (select count(*)::int from interactions i where i.user_id = u.id and not i.is_test and i.channel = 'ligacao' and i.at between ${from} and ${to}) as calls,
          (select count(*)::int from visits v join leads l on l.id = v.lead_id where not l.is_test and v.canceled_at is null and v.user_id = u.id and v.created_at between ${from} and ${to}) as sched,
          (select count(*)::int from deals dd where not dd.is_test and dd.sdr_id = u.id and dd.created_at between ${from} and ${to}) as conv,
          (select avg(extract(epoch from (s.saved_at - coalesce(s.started_at, s.shown_at)))) from attendance_sessions s where s.user_id = u.id and s.outcome = 'saved' and not s.is_test and s.saved_at between ${from} and ${to}) as secs
        from users u where u.id in (${U}) order by att desc, u.name`);
      sheets.push({ id: "pessoas", name: "Por pessoa", cols: [{ header: "Pessoa", key: "name", width: 24 }, { header: "Atendidos", key: "att", width: 12, fmt: "int" }, { header: "Qualificados", key: "q", width: 14, fmt: "int" }, { header: "Taxa qualif.", key: "pq", width: 13, fmt: "pct" }, { header: "Ligações", key: "calls", width: 12, fmt: "int" }, { header: "Agendados", key: "sched", width: 12, fmt: "int" }, { header: "Convertidos", key: "conv", width: 13, fmt: "int" }, { header: "Tempo médio", key: "t", width: 13 }], rows: r.map((x) => ({ name: x.name, att: x.att, q: x.q, pq: nfp(x.q, x.att), calls: x.calls, sched: x.sched, conv: x.conv, t: fmtDuration(x.secs) })) });
    }
    return { title: "Desempenho do SDR", subtitle: range, people, summary, sheets };
  }

  /* ───── Vendas ───── */
  const s = await getSalesStats(period, p.users);
  const vbase: [string, string | number, string?][] = [
    ["Vendas fechadas", s.won, `R$ ${brl(s.wonValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
    ["Valor vendido (R$)", brl(s.wonValue), "soma das vendas faturadas"],
    ["Ticket médio (R$)", s.ticket ? brl(s.ticket) : 0, "por venda fechada"],
    ["Conversão", s.conversion == null ? "—" : `${Math.round(s.conversion * 100)}%`, `${s.won} ganhas · ${s.lost} perdidas`],
    ["Perdidas", s.lost, `R$ ${brl(s.lostValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} perdidos`],
    ["Negociações em andamento", s.open, `R$ ${brl(s.stages.reduce((a, r) => a + r.v, 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em jogo`],
    ["Cotações enviadas", s.quotesSent, `R$ ${brl(s.quotesSentValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
    ["Contatos com clientes", s.contacts, "ligações, WhatsApp e e-mails"],
    ["Negociações recebidas", s.received, ""],
    ["Tempo até o 1º contato", s.firstContactMinutes == null ? "—" : `${Math.round(s.firstContactMinutes)} min`, ""],
    ["Ciclo de venda", s.cycleDays == null ? "—" : `${s.cycleDays.toFixed(1).replace(".", ",")} dias`, "da entrada ao faturamento"],
    ["Visitas (aguardando/confirmadas/realizadas)", `${s.visits.pending}/${s.visits.confirmed}/${s.visits.done}`, ""],
    ["Shuffler de vendas", s.shuffler.worked, `${s.shuffler.saved + s.shuffler.visit + s.shuffler.deal} aproveitados · ${s.shuffler.toSdr} devolvidos ao SDR`],
  ];
  summary.push({ label: "Vendas fechadas", value: String(s.won), hint: `R$ ${brl(s.wonValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` }, { label: "Conversão", value: s.conversion == null ? "—" : `${Math.round(s.conversion * 100)}%` }, { label: "Ticket médio", value: s.ticket ? `R$ ${brl(s.ticket).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—" }, { label: "Cotações enviadas", value: String(s.quotesSent) }, { label: "Contatos", value: String(s.contacts) }, { label: "Em andamento", value: String(s.open) });
  if (want.has("resumo")) sheets.push({ id: "resumo", name: "Resumo", cols: [{ header: "Indicador", key: "k", width: 40 }, { header: "Valor", key: "v", width: 20 }, { header: "Observação", key: "o", width: 46 }], rows: vbase.map(([k, v, o]) => ({ k, v, o: o ?? "" })) });
  if (want.has("diario")) {
    const r = await db.execute<{ b: string; won: number; val: number; contacts: number; quotes: number; qv: number }>(sql`
      with w as (select ${bucket(sql`${closedDay}::timestamp`, p.group)} as b, count(*)::int as won, coalesce(sum(${soldCents}),0)::bigint as val from deals d where d.seller_id in (${U}) and d.stage = 'ganho' and not d.is_test and ${closedDay} between ${p.from}::date and ${p.to}::date group by 1),
      c as (select ${bucket(sql`e.at`, p.group)} as b, count(*) filter (where e.kind in ('ligacao','whatsapp','email'))::int as contacts, count(*) filter (where e.kind = 'cotacao')::int as quotes, coalesce(sum(e.value_cents) filter (where e.kind = 'cotacao'),0)::bigint as qv from deal_events e join deals d on d.id = e.deal_id where not d.is_test and d.seller_id in (${U}) and e.at between ${from} and ${to} group by 1)
      select coalesce(w.b, c.b) as b, coalesce(w.won,0) as won, coalesce(w.val,0) as val, coalesce(c.contacts,0) as contacts, coalesce(c.quotes,0) as quotes, coalesce(c.qv,0) as qv from w full join c on c.b = w.b order by 1`);
    sheets.push({ id: "diario", name: p.group === "dia" ? "Por dia" : p.group === "semana" ? "Por semana" : "Por mês", cols: [{ header: p.group === "dia" ? "Dia" : p.group === "semana" ? "Semana" : "Mês", key: "b", width: 22 }, { header: "Vendas", key: "won", width: 10, fmt: "int" }, { header: "Valor vendido", key: "val", width: 18, fmt: "brl" }, { header: "Contatos", key: "contacts", width: 11, fmt: "int" }, { header: "Cotações", key: "quotes", width: 11, fmt: "int" }, { header: "Valor cotado", key: "qv", width: 18, fmt: "brl" }], rows: r.map((x) => ({ b: label(p.group, x.b), won: x.won, val: brl(Number(x.val)), contacts: x.contacts, quotes: x.quotes, qv: brl(Number(x.qv)) })) });
  }
  if (want.has("funil")) {
    const order = ["novo", "contato", "cotacao", "negociacao"] as const;
    const tot = s.stages.reduce((a, r) => a + r.n, 0);
    sheets.push({ id: "funil", name: "Funil", cols: [{ header: "Etapa", key: "e", width: 22 }, { header: "Negociações", key: "n", width: 14, fmt: "int" }, { header: "Valor", key: "v", width: 18, fmt: "brl" }, { header: "% das abertas", key: "p", width: 14, fmt: "pct" }], rows: order.map((k) => { const r = s.stages.find((x) => x.stage === k); return { e: STAGE_META[k].label, n: r?.n ?? 0, v: brl(r?.v ?? 0), p: nfp(r?.n ?? 0, tot) }; }) });
  }
  if (want.has("negociacoes")) {
    const r = await db.execute<{ id: number; company: string; cnpj: string; stage: string; val: number; seller: string | null; sdr: string | null; cr: Date; cl: Date | null; closed: Date | null; city: string | null; uf: string | null }>(sql`
      select d.id, l.company, l.cnpj, l.city, l.uf, d.stage, ${soldCents} as val, us.name as seller, ud.name as sdr, d.created_at as cr, d.claimed_at as cl, d.closed_at as closed
      from deals d join leads l on l.id = d.lead_id left join users us on us.id = d.seller_id left join users ud on ud.id = d.sdr_id
      where not d.is_test and d.seller_id in (${U}) and ((d.created_at between ${from} and ${to}) or (d.claimed_at between ${from} and ${to}) or (d.closed_at between ${from} and ${to}))
      order by coalesce(d.closed_at, d.claimed_at, d.created_at) desc limit 20000`);
    sheets.push({ id: "negociacoes", name: "Negociações", cols: [{ header: "Nº", key: "id", width: 8, fmt: "int" }, { header: "Empresa", key: "company", width: 38 }, { header: "CNPJ", key: "cnpj", width: 20 }, { header: "Cidade", key: "city", width: 20 }, { header: "UF", key: "uf", width: 6 }, { header: "Etapa", key: "stage", width: 16 }, { header: "Valor", key: "val", width: 16, fmt: "brl" }, { header: "Vendedor", key: "seller", width: 20 }, { header: "SDR de origem", key: "sdr", width: 20 }, { header: "Entrou em", key: "cr", width: 20, fmt: "datetime" }, { header: "Assumida em", key: "cl", width: 20, fmt: "datetime" }, { header: "Fechada em", key: "closed", width: 20, fmt: "datetime" }], rows: r.map((x) => ({ id: x.id, company: x.company, cnpj: x.cnpj, city: x.city, uf: x.uf, stage: STAGE_META[x.stage as keyof typeof STAGE_META]?.label ?? x.stage, val: brl(Number(x.val)), seller: x.seller, sdr: x.sdr, cr: d2(x.cr), cl: d2(x.cl), closed: d2(x.closed) })) });
  }
  if (want.has("cotacoes")) {
    const r = await db.execute<{ at: Date; company: string; seller: string | null; v: number | null; stage: string }>(sql`
      select e.at, l.company, us.name as seller, e.value_cents as v, d.stage from deal_events e join deals d on d.id = e.deal_id join leads l on l.id = d.lead_id left join users us on us.id = d.seller_id
      where e.kind = 'cotacao' and not d.is_test and d.seller_id in (${U}) and e.at between ${from} and ${to} order by e.at desc limit 20000`);
    sheets.push({ id: "cotacoes", name: "Cotações", cols: [{ header: "Data e hora", key: "at", width: 20, fmt: "datetime" }, { header: "Empresa", key: "company", width: 38 }, { header: "Vendedor", key: "seller", width: 20 }, { header: "Valor da cotação", key: "v", width: 18, fmt: "brl" }, { header: "Etapa atual", key: "stage", width: 16 }], rows: r.map((x) => ({ at: d2(x.at), company: x.company, seller: x.seller, v: brl(Number(x.v ?? 0)), stage: STAGE_META[x.stage as keyof typeof STAGE_META]?.label ?? x.stage })) });
  }
  if (want.has("visitas")) {
    const r = await db.execute<{ code: string; company: string; city: string | null; uf: string | null; vd: string | null; status: string; who: string | null; at: Date }>(sql`
      select v.code, l.company, l.city, l.uf, v.visit_date::text as vd, v.status, u.name as who, v.created_at as at from visits v join leads l on l.id = v.lead_id left join users u on u.id = v.seller_id
      where not l.is_test and v.canceled_at is null and v.seller_id in (${U}) and v.created_at between ${from} and ${to} order by v.created_at desc limit 20000`);
    sheets.push({ id: "visitas", name: "Visitas", cols: [{ header: "Código", key: "code", width: 12 }, { header: "Empresa", key: "company", width: 38 }, { header: "Cidade", key: "city", width: 20 }, { header: "UF", key: "uf", width: 6 }, { header: "Data da visita", key: "vd", width: 14, fmt: "date" }, { header: "Andamento", key: "status", width: 14 }, { header: "Vendedor", key: "who", width: 20 }, { header: "Agendada em", key: "at", width: 20, fmt: "datetime" }], rows: r.map((x) => ({ ...x, at: d2(x.at), status: { pendente: "Aguardando", confirmada: "Confirmada", realizada: "Realizada" }[x.status] ?? x.status })) });
  }
  if (want.has("pessoas")) sheets.push({ id: "pessoas", name: "Por vendedor", cols: [{ header: "Vendedor", key: "name", width: 24 }, { header: "Vendas", key: "won", width: 10, fmt: "int" }, { header: "Valor vendido", key: "value", width: 18, fmt: "brl" }, { header: "Cotações", key: "quotes", width: 11, fmt: "int" }, { header: "Valor cotado", key: "qv", width: 18, fmt: "brl" }, { header: "Contatos", key: "contacts", width: 11, fmt: "int" }, { header: "Em aberto", key: "open", width: 11, fmt: "int" }], rows: s.ranking.map((r) => ({ name: r.name, won: r.won, value: brl(r.value), quotes: r.quotes, qv: brl(r.quotesValue), contacts: r.contacts, open: r.open })) });
  return { title: "Desempenho de Vendas", subtitle: range, people, summary, sheets };
}
