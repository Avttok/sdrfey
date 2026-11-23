import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, users } from "@/db";
import { getCurrentUser } from "@/modules/auth/guard";
import { eoxBaseUrl, isRecordId } from "@/modules/eox/sync";
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
    const tel = typeof j.telefone === "string" ? j.telefone : null;
    // Código EOX da empresa dona do número (o parent_id do formulário), para o link abrir já com a empresa
    let parent: string | null = null;
    const key = (tel ?? "").replace(/\D/g, "").slice(-8);
    if (key.length === 8) {
      const rows = await db.execute<{ eox_id: string | null }>(sql`
        select l.eox_id from leads l where l.is_test = false and l.eox_id ~ '^\\d{7,}$' and (
          exists (select 1 from lead_channels c where c.lead_id = l.id and c.kind = 'phone' and right(regexp_replace(c.value, '\\D', '', 'g'), 8) = ${key})
          or exists (select 1 from unnest(l.phones) p where right(regexp_replace(p, '\\D', '', 'g'), 8) = ${key}))
        order by l.times_served desc, l.id limit 1`);
      const v = rows[0]?.eox_id ?? null;
      parent = isRecordId(v) ? v : null;
    }
    return NextResponse.json({ id: String(id), telefone: tel, atendida: Number(j.atendimento) === 1, empresa: typeof cli === "string" ? cli : null, parent, eoxBase: await eoxBaseUrl().catch(() => null) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ id: null });
  }
}
