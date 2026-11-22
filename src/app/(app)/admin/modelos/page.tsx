import { asc, isNull } from "drizzle-orm";
import { Mail } from "lucide-react";
import { PageHead } from "@/components/page-head";
import { TemplatesAdmin } from "@/components/admin/templates-admin";
import { db, emailTemplates } from "@/db";
import { getSettings } from "@/modules/settings/get";

export const dynamic = "force-dynamic";

export default async function Page() {
  const cfg = await getSettings();
  const rows = await db.select().from(emailTemplates).where(isNull(emailTemplates.ownerId)).orderBy(asc(emailTemplates.sort), asc(emailTemplates.id));
  return <div className="space-y-5"><PageHead icon={Mail} size="md" title="Modelos de e-mail" /><TemplatesAdmin rows={rows.map((r) => ({ id: r.id, name: r.name, subject: r.subject, body: r.body, bodyHtml: r.bodyHtml, active: r.active }))} img={{ px: cfg.email_img_px, kb: cfg.email_img_kb }} /></div>;
}
