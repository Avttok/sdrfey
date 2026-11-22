import { desc } from "drizzle-orm";
import { Megaphone } from "lucide-react";
import { AnnouncementsAdmin } from "@/components/admin/announcements-admin";
import { PageHead } from "@/components/page-head";
import { announcements, db } from "@/db";
import type { AnnEffect, AnnTheme } from "@/config/announcements";

export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await db.select().from(announcements).orderBy(desc(announcements.id)).limit(100);
  return <div className="space-y-5"><PageHead icon={Megaphone} size="md" title="Avisos globais" /><AnnouncementsAdmin rows={rows.map((r) => ({ id: r.id, title: r.title, body: r.body, theme: r.theme as AnnTheme, effect: r.effect as AnnEffect, roles: r.roles, active: r.active, expiresAt: r.expiresAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() }))} /></div>;
}
