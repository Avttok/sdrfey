import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, users } from "@/db";
import { getCurrentUser } from "@/modules/auth/guard";
import { eoxBaseUrl, eoxRecordForCall } from "@/modules/eox/sync";
import { settingValue } from "@/modules/settings/get";
import { parseVocall, VOCALL_KEY } from "@/modules/vocall/config";

export const dynamic = "force-dynamic";

/**
 * Busca no VocallAgent a qualificação pendente da pessoa logada (o mesmo "qualificacao.php" que a EOX usa).
 * Vai pelo servidor porque o navegador não consegue chamar um endereço http de dentro de uma página https.
 * O agente vem do cadastro da própria pessoa, nunca do pedido.
 */
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword) return NextResponse.json({ id: null }, { status: 401 });
  const cfg = parseVocall(await settingValue(VOCALL_KEY));
  const [u] = await db.select({ a: users.vocallAgentId }).from(users).where(eq(users.id, me.id));
  if (!cfg.on || !cfg.host || !u?.a) return NextResponse.json({ id: null });
  /** Número discado: com ele o Código EOX (parent_id) sai do cadastro mesmo quando a central não tem pendência. */
  const asked = String(((await req.json().catch(() => ({}))) as { telefone?: unknown }).telefone ?? "").replace(/\D/g, "");
  const parentOf = async (tel: string | null): Promise<string | null> => {
    const d = (tel ?? "").replace(/\D/g, "");
    if (d.length < 8) return null;
    return (await eoxRecordForCall(me.id, d)).record;
  };
  try {
    const r = await fetch(`${cfg.secure ? "https" : "http"}://${cfg.host}/vocallagent/qualificacao.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_agente: u.a }),
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    const j = JSON.parse(await r.text()) as { id_qualificacao_pendente?: unknown; telefone?: unknown; atendimento?: unknown; cliente?: unknown };
    const id = j.id_qualificacao_pendente;
    if ((typeof id !== "string" && typeof id !== "number") || !/^\d+$/.test(String(id))) return NextResponse.json({ id: null, parent: asked ? await parentOf(asked) : null, eoxBase: await eoxBaseUrl().catch(() => null) }); // "Desconhecido" = sem qualificação
    const cli = j.cliente && typeof j.cliente === "object" ? (j.cliente as { label?: unknown }).label : null;
    const tel = typeof j.telefone === "string" ? j.telefone : null;
    const parent = await parentOf(asked || tel);
    return NextResponse.json({ id: String(id), telefone: tel, atendida: Number(j.atendimento) === 1, empresa: typeof cli === "string" ? cli : null, parent, eoxBase: await eoxBaseUrl().catch(() => null) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ id: null, parent: asked ? await parentOf(asked).catch(() => null) : null });
  }
}
