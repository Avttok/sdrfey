import { NextResponse } from "next/server";
import { db } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { getCurrentUser } from "@/modules/auth/guard";
import { allowedDatasets } from "@/modules/export/access";
import { streamPackage } from "@/modules/export/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Pacote completo: uma pasta de trabalho Excel (ou PDF, ou .zip de CSVs) com uma base por planilha, mais o Resumo. */
export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me || (!me.isAdmin && !me.permissions["tab.exportar"])) return new NextResponse("Sem acesso.", { status: 403 });
  const keys = allowedDatasets(me).map((d) => d.key);
  if (!keys.length) return new NextResponse("Nenhuma base liberada para você.", { status: 403 });
  const f = new URL(req.url).searchParams.get("format");
  const format = f === "pdf" || f === "csv" ? f : "xlsx";
  const { stream, filename, mime } = streamPackage(keys, format);
  await logAudit(db, { userId: me.id, entity: "setting", action: "exportou dados", field: "Pacote completo", newValue: `${format} · ${keys.join(", ")}` });
  return new NextResponse(stream, { headers: { "Content-Type": mime, "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
}
