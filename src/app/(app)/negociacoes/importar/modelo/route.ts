import { NextResponse } from "next/server";
import Papa from "papaparse";
import { requirePerm } from "@/modules/auth/guard";
import { DEAL_TEMPLATE_HEADERS, DEAL_TEMPLATE_ROWS } from "@/modules/import/deals-parse";

export const dynamic = "force-dynamic";

/** Modelo da planilha do vendedor (CSV com ponto e vírgula, abre direto no Excel). */
export async function GET() {
  await requirePerm("tab.negociacoes");
  const csv = Papa.unparse({ fields: DEAL_TEMPLATE_HEADERS, data: DEAL_TEMPLATE_ROWS }, { delimiter: ";" });
  return new NextResponse(`﻿${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="modelo-negociacoes.csv"', "Cache-Control": "no-store" } });
}
