import { asc } from "drizzle-orm";
import { TemplatesAdmin } from "@/components/admin/templates-admin";
import { db, emailTemplates } from "@/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await db.select().from(emailTemplates).orderBy(asc(emailTemplates.sort), asc(emailTemplates.id));
  return <TemplatesAdmin rows={rows.map((r) => ({ id: r.id, name: r.name, subject: r.subject, body: r.body, active: r.active }))} />;
}
