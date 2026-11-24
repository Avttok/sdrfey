"use client";

import type { useToast } from "@/components/toast";
import type { useVocall } from "@/components/vocall-provider";
import { resolveEoxLinkAction } from "@/modules/eox/actions";
import { trackTouch } from "@/lib/touch-bus";
import { parseEoxUrl } from "@/modules/vocall/eox";

/**
 * "Ligar": se a pessoa tem agente/ramal configurados, pede a chamada ao VocallPhone (como o clique no número da EOX).
 * Sem isso, ou se o app não confirmar, copia o número já pronto para colar no VocallPhone e dar Enter. No celular abre o discador.
 */
export const callNumber = async (digits: string, label: string | null, toast: ReturnType<typeof useToast>, vocall: ReturnType<typeof useVocall>, lead?: { id: number; eoxUrl: string | null; eoxInfo?: Record<string, string> | null }, personId?: number | null) => {
  /** Cada ligação vira um registro daquele número; o painel pergunta como foi. */
  const track = (viaVocall = false) => { if (lead) void trackTouch({ leadId: lead.id, channel: "call", target: digits, label, personId: personId ?? null, defer: viaVocall, waitEnd: viaVocall }); };
  if (vocall.configured) {
    // sem o link do cadastro da EOX o Atendimento da EOX abre em branco: procura agora pelo CNPJ (se a integração estiver ligada)
    let url = lead?.eoxUrl ?? null;
    if (!url) url = await resolveEoxLinkAction(digits, lead?.id ?? null).catch(() => null);
    const eox = parseEoxUrl(url);
    toast("info", "Pedindo a ligação ao VocallPhone…");
    if (await vocall.dial(digits, label, eox)) { toast("ok", "Ligando pelo VocallPhone."); track(true); return; }
    toast("warn", "O VocallPhone não confirmou. Número copiado: cole no app e dê Enter.");
  } else toast("info", "Número copiado. No VocallPhone, cole (Ctrl+V) e dê Enter.");
  track();
  try { await navigator.clipboard.writeText(digits); } catch { toast("warn", "Não consegui copiar. Selecione o número e copie manualmente."); }
  if (typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent)) window.location.href = `tel:+55${digits.replace(/^55/, "")}`;
};

