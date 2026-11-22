import { NextResponse } from "next/server";
import { eq, gt, and } from "drizzle-orm";
import { db, liveWatch } from "@/db";
import { getCurrentUser } from "@/modules/auth/guard";

export const dynamic = "force-dynamic";

/** A pessoa pergunta, de tempos em tempos, se alguém do Adm está olhando a tela dela. Resposta minúscula. */
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword) return NextResponse.json({ watch: false }, { status: 401 });
  const [w] = await db.select({ u: liveWatch.until }).from(liveWatch).where(and(eq(liveWatch.userId, me.id), gt(liveWatch.until, new Date())));
  return NextResponse.json({ watch: !!w }, { headers: { "Cache-Control": "no-store" } });
}
