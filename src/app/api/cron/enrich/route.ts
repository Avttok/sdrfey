import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { cleanTemp } from "@/modules/admin/temp-clean";
import { autoEnrichOn, enrichBatch } from "@/modules/enrich/batch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Chamada pela tarefa agendada da Vercel (vercel.json). A Vercel manda "Authorization: Bearer CRON_SECRET". */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  await cleanTemp(db).catch(() => null); // faxina diária dos temporários (nunca atrapalha a consulta)
  if (!(await autoEnrichOn())) return NextResponse.json({ skipped: "desligado" });
  return NextResponse.json(await enrichBatch(10, 50_000, null, "cron"));
}
