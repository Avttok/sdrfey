import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/guard";
import { settingValue } from "@/modules/settings/get";
import { parseVocall, VOCALL_KEY } from "@/modules/vocall/config";

export const dynamic = "force-dynamic";

/** Só aceita o servidor configurado em Ligações (ou outro nome do mesmo domínio): este caminho nunca vira um proxy aberto. */
const sameDomain = (a: string, b: string) => {
  const t = (h: string) => h.toLowerCase().split(".").slice(-3).join(".");
  return a.toLowerCase() === b.toLowerCase() || (a.includes(".") && t(a) === t(b));
};

async function post(url: string, body: Record<string, string>): Promise<unknown> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body), signal: AbortSignal.timeout(8000), cache: "no-store" });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { raw: t.slice(0, 300), http: r.status }; }
}

/**
 * Teste do telefone no navegador (só Adm): faz no servidor o que o VocallPhone faz ao abrir,
 * "verificarRamalFake.php" e "login_agente.php" (o navegador não pode chamar a API da central por causa do CORS).
 * A senha do ramal só passa por aqui, nunca é guardada.
 */
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword || !me.isAdmin) return NextResponse.json({ ok: false, message: "Só o Adm." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { dns?: string; ramal?: string; senha?: string; agente?: string };
  const cfg = parseVocall(await settingValue(VOCALL_KEY));
  const dns = String(b.dns ?? "").trim().replace(/^https?:\/\//i, "").replace(/[/:].*$/, "");
  const ramal = String(b.ramal ?? "").replace(/\D/g, "");
  const agente = String(b.agente ?? "").trim();
  const senha = String(b.senha ?? "");
  if (!cfg.host || !dns || !sameDomain(dns, cfg.host)) return NextResponse.json({ ok: false, message: "Servidor diferente do configurado em Ligações." }, { status: 400 });
  if (!ramal || !agente || !senha) return NextResponse.json({ ok: false, message: "Falta ramal, senha do ramal ou agente." }, { status: 400 });
  try {
    const fake = (await post(`https://${dns}/api/verificarRamalFake.php`, { idRamal: `fake_${ramal}`, senha })) as { status?: boolean };
    if (fake?.status !== true) return NextResponse.json({ ok: false, step: "verificarRamalFake", message: "A central não aceitou o ramal fake.", detail: fake });
    const login = await post(`https://${dns}/api/login_agente.php`, { idRamal: ramal, idAgente: agente, senha, verificarRegistroRamal: "true" });
    const l = login as { status?: boolean; statusRamal?: unknown; msg?: string };
    const okRamal = l?.status === true && l?.statusRamal === true;
    return NextResponse.json({ ok: okRamal, step: "login_agente", message: okRamal ? "Ramal liberado." : l?.msg ?? "O ramal não está registrado.", detail: login });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Sem resposta da central." });
  }
}
