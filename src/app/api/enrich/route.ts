import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/modules/auth/guard";
import { refreshInfo } from "@/modules/enrich/refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Consulta de CNPJ por rota (e não por ação do servidor): ações ficam numa fila e travam a navegação
 * até terminarem; uma consulta lenta deixava o sistema todo parado para a pessoa.
 */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword) return NextResponse.json({ ok: false, message: "Sessão expirada. Entre de novo." }, { status: 401 });
  if (!me.permissions["tab.comecar"] && !me.permissions["tab.leads"]) return NextResponse.json({ ok: false, message: "Sem permissão." }, { status: 403 });
  const { leadId } = (await req.json().catch(() => ({}))) as { leadId?: number };
  if (!Number.isInteger(leadId) || (leadId as number) <= 0) return NextResponse.json({ ok: false, message: "Lead inválido." }, { status: 400 });
  try {
    const r = await refreshInfo(leadId as number, me.id);
    revalidatePath("/atender");
    revalidatePath(`/leads/${leadId}`);
    return NextResponse.json(r);
  } catch {
    return NextResponse.json({ ok: false, message: "Não consegui consultar agora. Tente de novo em instantes." });
  }
}
