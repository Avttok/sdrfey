import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/guard";
import { dockCore, startCore, stopCore, tickCore } from "@/modules/enrich/daemon-core";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Painel da consulta contínua de CNPJ (só Adm). Fica numa rota comum, e não em ação do servidor, de propósito:
 * o Next executa as ações do servidor uma por vez, então um passo demorado da consulta travava todos os botões do site.
 */
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me?.isAdmin) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { op?: string; scope?: string | number };
  try {
    switch (body.op) {
      case "dock": return NextResponse.json(await dockCore(me));
      case "start": return NextResponse.json(await startCore(me, body.scope ?? "new"));
      case "stop": return NextResponse.json(await stopCore(me));
      case "tick": return NextResponse.json(await tickCore(me));
      default: return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
    }
  } catch { return NextResponse.json({ error: "Falha ao consultar." }, { status: 500 }); }
}
