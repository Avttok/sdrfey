import { NextResponse, type NextRequest } from "next/server";
import { syncEoxLinks } from "@/modules/eox/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Tarefa diária da Vercel: preenche o link da EOX nos leads que ainda não têm. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const r = await syncEoxLinks({ budgetMs: 45_000 });
  return NextResponse.json(r);
}
