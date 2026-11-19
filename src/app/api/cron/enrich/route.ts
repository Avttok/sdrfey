import { NextResponse, type NextRequest } from "next/server";
import { autoEnrichOn, enrichBatch } from "@/modules/enrich/batch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Chamada pela tarefa agendada da Vercel (vercel.json). A Vercel manda "Authorization: Bearer CRON_SECRET". */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  if (!(await autoEnrichOn())) return NextResponse.json({ skipped: "desligado" });
  return NextResponse.json(await enrichBatch(40, 50_000));
}
