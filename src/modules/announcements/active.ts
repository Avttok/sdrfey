import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { announcements, db } from "@/db";
import { ANN_THEMES, effectOf, type AnnEffect, type AnnTheme, type AnnView } from "@/config/announcements";
import type { Role } from "@/config/roles";

/** Avisos que valem agora para quem tem estes cargos (os mais novos primeiro, no máximo 5). */
export async function activeAnnouncements(roles: readonly Role[], isAdmin: boolean): Promise<AnnView[]> {
  const mine = [...roles, ...(isAdmin ? (["admin"] as const) : [])];
  const rows = await db.select().from(announcements).where(and(eq(announcements.active, true), or(isNull(announcements.expiresAt), gt(announcements.expiresAt, sql`now()`)))).orderBy(desc(announcements.id)).limit(30);
  return rows
    .filter((r) => r.roles.length === 0 || r.roles.some((x) => mine.includes(x as Role)))
    .slice(0, 5)
    .map((r) => { const theme = (r.theme in ANN_THEMES ? r.theme : "aviso") as AnnTheme; return { id: r.id, title: r.title, body: r.body, theme, effect: effectOf(theme, r.effect as AnnEffect) }; });
}
