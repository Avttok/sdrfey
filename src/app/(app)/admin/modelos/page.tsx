import { asc } from "drizzle-orm";
import { Mail } from "lucide-react";
import { PageHead } from "@/components/page-head";
import { TemplatesAdmin } from "@/components/admin/templates-admin";
import { db, emailTemplates } from "@/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await db.select().from(emailTemplates).orderBy(asc(emailTemplates.sort), asc(emailTemplates.id));
  return <div className="space-y-5"><PageHead icon={Mail} size="md" title="Modelos de e-mail" /><TemplatesAdmin rows={rows.map((r) => ({ id: r.id, name: r.name, subject: r.subject, body: r.body, bodyHtml: r.bodyHtml, active: r.active }))} /></div>;
}
