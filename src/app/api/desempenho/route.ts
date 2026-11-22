import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/modules/auth/guard";
import { parseParams } from "@/modules/performance/access";
import { buildReport, type Kind } from "@/modules/performance/report";
import { buildReportPdf, buildWorkbook, sheetCsv } from "@/modules/performance/xlsx";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Baixa o desempenho em .xlsx (todas as abas), .pdf (todas as abas) ou .csv (uma aba). */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword) return NextResponse.json({ error: "login" }, { status: 401 });
  const q = req.nextUrl.searchParams;
  const kind: Kind = q.get("kind") === "vendas" ? "vendas" : "sdr";
  const v = await parseParams(me, kind, { from: q.get("from"), to: q.get("to"), sections: q.get("sections"), users: q.get("users"), group: q.get("group") });
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
  const report = await buildReport(v.params, v.names);
  const base = `desempenho-${kind}-${v.params.from}_a_${v.params.to}`;
  if (q.get("format") === "csv") return new NextResponse(sheetCsv(report, q.get("sheet") ?? undefined), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${base}.csv"` } });
  if (q.get("format") === "pdf") return new NextResponse(Buffer.from(await buildReportPdf(report)), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${base}.pdf"` } });
  const buf = await buildWorkbook(report);
  return new NextResponse(new Uint8Array(buf), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${base}.xlsx"` } });
}
