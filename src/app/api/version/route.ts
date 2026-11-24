import { NextResponse } from "next/server";
import { getSettings } from "@/modules/settings/get";

export const dynamic = "force-dynamic";

/** Versão que está no ar agora (a página compara com a que ela carregou) e se o Adm deixou o aviso ligado. */
export async function GET() {
  const s = await getSettings().catch(() => null);
  return NextResponse.json({ v: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev", on: s ? s.update_notice === 1 : true }, { headers: { "Cache-Control": "no-store" } });
}
