import { NextResponse } from "next/server";
import { db } from "@/db";
import { EX_MAX_ROWS } from "@/config/export-spec";
import { logAudit } from "@/modules/audit/log";
import { getCurrentUser } from "@/modules/auth/guard";
import { canExport } from "@/modules/export/access";
import { cleanRequest, streamExport } from "@/modules/export/run";
import { EX_BY_KEY } from "@/config/export-spec";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Baixa uma base já filtrada. O pedido vem em `q` (JSON em base64url); só passa quem tem a aba Exportar e a base liberada. Fica no Registro. */
export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me || (!me.isAdmin && !me.permissions["tab.exportar"])) return new NextResponse("Sem acesso.", { status: 403 });
  let parsed: unknown = null;
  try { parsed = JSON.parse(Buffer.from(new URL(req.url).searchParams.get("q") ?? "", "base64url").toString("utf8")); } catch { /* pedido inválido */ }
  const r = cleanRequest(parsed);
  if (!r) return new NextResponse("Pedido de exportação inválido.", { status: 400 });
  if (!canExport(me, r.dataset)) return new NextResponse("Você não tem acesso a esta base.", { status: 403 });
  const { stream, filename, mime } = streamExport({ ...r, limit: r.limit ? Math.min(r.limit, EX_MAX_ROWS) : null });
  await logAudit(db, { userId: me.id, entity: "setting", action: "exportou dados", field: EX_BY_KEY.get(r.dataset)!.label, newValue: `${r.format} · ${r.columns.length} colunas · ${Object.keys(r.filters).length} filtros` });
  return new NextResponse(stream, { headers: { "Content-Type": mime, "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
}
