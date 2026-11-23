import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, users } from "@/db";
import { getCurrentUser } from "@/modules/auth/guard";
import { settingValue } from "@/modules/settings/get";
import { parseVocall, VOCALL_KEY } from "@/modules/vocall/config";

export const dynamic = "force-dynamic";

/**
 * Busca no VocallAgent a qualificação pendente da pessoa logada (o mesmo "qualificacao.php" que a EOX usa).
 * Vai pelo servidor porque o navegador não consegue chamar um endereço http de dentro de uma página https.
 * O agente vem do cadastro da própria pessoa, nunca do pedido.
 */
export async function POST() {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword) return NextResponse.json({ id: null }, { status: 401 });
  const cfg = parseVocall(await settingValue(VOCALL_KEY));
  const [u] = await db.select({ a: users.vocallAgentId }).from(users).where(eq(users.id, me.id));
  if (!cfg.on || !cfg.host || !u?.a) return NextResponse.json({ id: null });
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
    if ((typeof id !== "string" && typeof id !== "number") || !/^\d+$/.test(String(id))) return NextResponse.json({ id: null }); // "Desconhecido" = sem qualificação
    const cli = j.cliente && typeof j.cliente === "object" ? (j.cliente as { label?: unknown }).label : null;
    return NextResponse.json({ id: String(id), telefone: typeof j.telefone === "string" ? j.telefone : null, atendida: Number(j.atendimento) === 1, empresa: typeof cli === "string" ? cli : null }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ id: null });
  }
}
