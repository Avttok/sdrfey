import { sql } from "drizzle-orm";
import Papa from "papaparse";
import { attendanceSessions, auditLog, db, emailTemplates, interactions, leadChannels, leadPeople, leads, leadTags, reps, settings, tagGroups, tags, users, visits } from "@/db";

export const EXPORT_KINDS = {
  leads: { label: "Leads", file: "leads.csv", hint: "Mesmas colunas da importação. Dá para reimportar em outro banco." },
  representantes: { label: "Representantes", file: "representantes.csv", hint: "Lista de representantes, gestores e equipes." },
  registro: { label: "Registro de atividades", file: "registro.csv", hint: "Todo o histórico de alterações: quem, quando, de e para." },
  usuarios: { label: "Usuários", file: "usuarios.csv", hint: "Contas, cargos e metas. Sem senhas." },
  backup: { label: "Backup completo", file: "backup.json", hint: "Todas as tabelas em um arquivo (sem senhas). Guarde em lugar seguro." },
} as const;
export type ExportKind = keyof typeof EXPORT_KINDS;
export const isExportKind = (k: string): k is ExportKind => k in EXPORT_KINDS;

const csv = (rows: Record<string, unknown>[]) => "﻿" + Papa.unparse(rows, { delimiter: ";", newline: "\r\n" });
const brDate = (d: Date | null) => (d ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(d) : "");
const tagList = (group: string) => sql.raw(`(select string_agg(t.label, ', ' order by t.sort) from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = l.id and t.group_key = '${group}')`);

export async function buildExport(kind: ExportKind): Promise<{ body: string; type: string }> {
  if (kind === "leads") {
    const rows = await db.execute<Record<string, string | number | null>>(sql`
      select l.cnpj as "CNPJ", l.company as "EMPRESA", l.sap_code as "CODSAP", l.contact_name as "CONTATO", l.role_title as "CARGO", l.notes as "OBSERVACAO",
        (select string_agg(c.value, ', ' order by c.id) from lead_channels c where c.lead_id = l.id and c.kind = 'phone' and not c.wrong) as "TELEFONE",
        (select string_agg(c.value, ', ' order by c.id) from lead_channels c where c.lead_id = l.id and c.kind = 'email' and not c.wrong) as "EMAIL",
        ${tagList("temperatura")} as "INTERESSE",
        ${tagList("meio")} as "MEIO",
        (case when exists (select 1 from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = l.id and t.group_key = 'qualificacao' and t.key = 'qualificado') then 'SIM'
              when exists (select 1 from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = l.id and t.group_key = 'qualificacao') then 'NÃO' else '' end) as "QUALIFICADO",
        (case when exists (select 1 from visits v where v.lead_id = l.id and v.canceled_at is null) then 'SIM' else '' end) as "AGENDADO",
        ${tagList("situacao")} as "SITUACAO",
        (select o.name from users o where o.id = l.owner_id) as "OPSDR",
        (select string_agg(v.code, ', ' order by v.created_at) from visits v where v.lead_id = l.id and v.canceled_at is null) as "VISITA",
        ${tagList("porte")} as "PORTE",
        ${tagList("capital")} as "CAPITAL",
        to_char(l.updated_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') as "ATT",
        l.times_served as "SHUFFLADO", l.city as "CIDADE", l.uf as "UF", l.registration_status as "SITUACAO CADASTRAL"
      from leads l where not l.is_test order by l.id`);
    return { body: csv([...rows]), type: "text/csv; charset=utf-8" };
  }
  if (kind === "representantes") {
    const r = await db.select().from(reps).orderBy(reps.id);
    return { body: csv(r.map((x) => ({ ESC: x.esc, GESTOR: x.managerName, EQUIPE: x.team, CODSAP: x.sapCode, CNPJ: x.cnpj, ENDERECO: x.address, CEP: x.cep, CIDADE: x.city, UF: x.uf, REPRESENTANTE: x.repName, ATIVO: x.active ? "SIM" : "NÃO" }))), type: "text/csv; charset=utf-8" };
  }
  if (kind === "registro") {
    const r = await db.execute<Record<string, unknown>>(sql`
      select to_char(a.at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI:SS') as "Quando (Brasília)", coalesce(u.name, 'Sistema') as "Quem", a.entity as "Tipo", a.action as "Ação", a.field as "Campo", a.old_value as "De", a.new_value as "Para", l.company as "Lead", l.cnpj as "CNPJ"
      from audit_log a left join users u on u.id = a.user_id left join leads l on l.id = a.lead_id order by a.at desc, a.id desc`);
    return { body: csv([...r]), type: "text/csv; charset=utf-8" };
  }
  if (kind === "usuarios") {
    const r = await db.select().from(users).orderBy(users.id);
    return { body: csv(r.map((u) => ({ USUARIO: u.username, NOME: u.name, CARGOS: u.roles.join(", "), ATIVO: u.active ? "SIM" : "NÃO", COR: u.accent ?? "", META_ATENDIDOS: u.dailyGoal ?? "", META_AGENDADOS: u.dailyGoalScheduled ?? "", NAS_METRICAS: u.inMetrics ? "SIM" : "NÃO", ULTIMO_LOGIN: brDate(u.lastLoginAt), CRIADO_EM: brDate(u.createdAt) }))), type: "text/csv; charset=utf-8" };
  }
  const [lds, lt, ch, pe, ints, vis, rp, tg, tgr, st, au, tpl, ses, us] = await Promise.all([
    db.select().from(leads), db.select().from(leadTags), db.select().from(leadChannels), db.select().from(leadPeople), db.select().from(interactions), db.select().from(visits),
    db.select().from(reps), db.select().from(tags), db.select().from(tagGroups), db.select().from(settings), db.select().from(auditLog), db.select().from(emailTemplates), db.select().from(attendanceSessions), db.select().from(users),
  ]);
  const body = JSON.stringify({
    app: "SDR FEY", geradoEm: new Date().toISOString(), versao: 1,
    users: us.map(({ passwordHash: _p, ...u }) => u),
    leads: lds, lead_tags: lt, lead_channels: ch, lead_people: pe, interactions: ints, visits: vis, attendance_sessions: ses,
    reps: rp, tag_groups: tgr, tags: tg, settings: st, email_templates: tpl, audit_log: au,
  });
  return { body, type: "application/json; charset=utf-8" };
}
