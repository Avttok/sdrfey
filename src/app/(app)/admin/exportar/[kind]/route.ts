import { NextResponse } from "next/server";
import { db } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";
import { EX_BY_KEY, type ExDatasetKey } from "@/config/export-spec";
import { buildExport, EXPORT_KINDS, isExportKind } from "@/modules/export/build";
import { streamExport } from "@/modules/export/run";

const DATASET: Partial<Record<string, ExDatasetKey>> = { leads: "leads", representantes: "representantes", registro: "registro", usuarios: "usuarios" };

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Exportação do banco (só Adm). Cada download fica registrado no Registro. */
export async function GET(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const me = await requireAdmin();
  const { kind } = await ctx.params;
  if (!isExportKind(kind)) return new NextResponse("Tipo de exportação desconhecido.", { status: 404 });
  const fmt = new URL(req.url).searchParams.get("format");
  const ds = DATASET[kind];
  if (ds && (fmt === "xlsx" || fmt === "pdf")) {
    const d = EX_BY_KEY.get(ds)!;
    const { stream, filename, mime } = streamExport({ dataset: ds, columns: d.columns.map((c) => c.key), filters: {}, format: fmt, sort: null, limit: null });
    await logAudit(db, { userId: me.id, entity: "setting", action: "exportou dados", field: EXPORT_KINDS[kind].label, newValue: fmt });
    return new NextResponse(stream, { headers: { "Content-Type": mime, "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
  }
  const { body, type } = await buildExport(kind);
  await logAudit(db, { userId: me.id, entity: "setting", action: "exportou dados", field: EXPORT_KINDS[kind].label });
  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  return new NextResponse(body, { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="sdrfey-${stamp}-${EXPORT_KINDS[kind].file}"`, "Cache-Control": "no-store" } });
}
