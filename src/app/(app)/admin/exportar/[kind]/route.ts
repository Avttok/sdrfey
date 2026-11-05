import { NextResponse } from "next/server";
import { db } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";
import { buildExport, EXPORT_KINDS, isExportKind } from "@/modules/export/build";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Exportação do banco (só Adm). Cada download fica registrado no Registro. */
export async function GET(_req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const me = await requireAdmin();
  const { kind } = await ctx.params;
  if (!isExportKind(kind)) return new NextResponse("Tipo de exportação desconhecido.", { status: 404 });
  const { body, type } = await buildExport(kind);
  await logAudit(db, { userId: me.id, entity: "setting", action: "exportou dados", field: EXPORT_KINDS[kind].label });
  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  return new NextResponse(body, { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="sdrfey-${stamp}-${EXPORT_KINDS[kind].file}"`, "Cache-Control": "no-store" } });
}
