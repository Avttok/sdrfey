import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/modules/auth/guard";
import { usageRows } from "@/modules/scripts/usage";

export const dynamic = "force-dynamic";

/** Baixa o uso dos roteiros em CSV. Só Adm. */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword || !me.roles.includes("admin")) return NextResponse.json({ error: "proibido" }, { status: 403 });
  const q = req.nextUrl.searchParams;
  const days = Number(q.get("days")); const uid = Number(q.get("user"));
  const rows = await usageRows({ days: days > 0 ? days : null, userId: uid > 0 ? uid : null, withTests: q.get("tests") === "1" });
  const head = ["id", "started_at", "usuario", "empresa", "roteiro", "objetivo", "categoria", "segmento", "concluida", "resultado", "segundos", "passos", "teste"];
  const cell = (v: unknown) => { const s = v instanceof Date ? v.toISOString() : String(v ?? ""); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = "﻿" + [head.join(";"), ...rows.map((r) => head.map((h) => cell(r[h])).join(";"))].join("\r\n");
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="uso-dos-roteiros.csv"' } });
}
