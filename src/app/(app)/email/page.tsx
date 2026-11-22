import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { Mail } from "lucide-react";
import { PageHead } from "@/components/page-head";
import { MyTemplates } from "@/components/my-templates";
import { db, emailTemplates } from "@/db";
import { requirePerm } from "@/modules/auth/guard";
import { getSettings } from "@/modules/settings/get";

export const metadata: Metadata = { title: "E-mail" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requirePerm("tab.email");
  const cfg = await getSettings();
  const rows = await db.select().from(emailTemplates).where(and(eq(emailTemplates.ownerId, me.id))).orderBy(asc(emailTemplates.id));
  return <div className="space-y-5"><PageHead icon={Mail} size="md" title="Meus modelos de e-mail" /><p className="max-w-2xl text-sm text-muted">Modelos só seus: aparecem no passo E-mail do Shuffler junto com os do time.</p><MyTemplates rows={rows.map((r) => ({ id: r.id, name: r.name, subject: r.subject, body: r.body, bodyHtml: r.bodyHtml, active: r.active }))} img={{ px: cfg.email_img_px, kb: cfg.email_img_kb }} /></div>;
}
