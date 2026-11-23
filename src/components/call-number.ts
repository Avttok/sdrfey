"use client";

import type { useToast } from "@/components/toast";
import type { useVocall } from "@/components/vocall-provider";
import { ensureEoxLinkAction } from "@/modules/eox/actions";
import { parseEoxUrl } from "@/modules/vocall/eox";

/**
 * "Ligar": se a pessoa tem agente/ramal configurados, pede a chamada ao VocallPhone (como o clique no número da EOX).
 * Sem isso, ou se o app não confirmar, copia o número já pronto para colar no VocallPhone e dar Enter. No celular abre o discador.
 */
export const callNumber = async (digits: string, label: string | null, toast: ReturnType<typeof useToast>, vocall: ReturnType<typeof useVocall>, lead?: { id: number; eoxUrl: string | null; eoxInfo?: Record<string, string> | null }) => {
  if (/^sim$/i.test(lead?.eoxInfo?.["Discagens bloqueadas"] ?? "") && !window.confirm(`A EOX marca a discagem deste cliente como BLOQUEADA${lead?.eoxInfo?.["Motivo bloqueio"] ? ` (${lead.eoxInfo["Motivo bloqueio"]})` : ""}.\n\nLigar mesmo assim?`)) return;
  if (vocall.configured) {
    // sem o link do cadastro da EOX o Atendimento da EOX abre em branco: procura agora pelo CNPJ (se a integração estiver ligada)
    let url = lead?.eoxUrl ?? null;
    if (!url && lead) url = await ensureEoxLinkAction(lead.id).catch(() => null);
    const eox = parseEoxUrl(url);
    if (!eox && !window.confirm("Este lead não tem Código EOX, então a ligação NÃO gera qualificação.\n\nLigar mesmo assim?")) return;
    toast("info", eox ? "Pedindo a ligação ao VocallPhone…" : "Ligando sem Código EOX: não vai gerar qualificação.");
    if (await vocall.dial(digits, label, eox)) { toast("ok", "Ligando pelo VocallPhone."); return; }
    toast("warn", "O VocallPhone não confirmou. Número copiado: cole no app e dê Enter.");
  } else toast("info", "Número copiado. No VocallPhone, cole (Ctrl+V) e dê Enter.");
  try { await navigator.clipboard.writeText(digits); } catch { toast("warn", "Não consegui copiar. Selecione o número e copie manualmente."); }
  if (typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent)) window.location.href = `tel:+55${digits.replace(/^55/, "")}`;
};

