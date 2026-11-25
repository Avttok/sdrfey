import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/guard";
import { eoxDock, eoxStart, eoxStop, eoxTick } from "@/modules/eox/consult-daemon";
import { eoxPreview } from "@/modules/eox/consult";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Painel da Consulta EOX (só Adm). Rota comum, e não ação do servidor, para um passo demorado não travar os botões do site. */
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me?.isAdmin) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { op?: string; scope?: string; query?: string };
  try {
    switch (body.op) {
      case "dock": return NextResponse.json(await eoxDock(me));
      case "start": return NextResponse.json(await eoxStart(me, body.scope ?? "new"));
      case "stop": return NextResponse.json(await eoxStop(me));
      case "tick": return NextResponse.json(await eoxTick(me));
      case "preview": return NextResponse.json(await eoxPreview(String(body.query ?? "")));
      default: return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
    }
  } catch { return NextResponse.json({ error: "Falha ao consultar." }, { status: 500 }); }
}
