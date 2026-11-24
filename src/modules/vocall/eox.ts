/** O VocallAgent precisa saber qual cadastro da EOX é a ligação (crmid + tipo), senão o formulário de Atendimento abre em branco. */
export type EoxRef = { crmid: string; setype: string; /** Endereço da EOX (de onde veio o link). */ origin: string };

/** Lê o link do cliente na EOX (…index.php?module=Accounts&view=Detail&record=1293925). null se não der para achar o cadastro. */
export function parseEoxUrl(url: string | null | undefined): EoxRef | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim(), "https://x.invalid");
    const origin = u.origin === "https://x.invalid" ? "" : u.origin;
    const crmid = (u.searchParams.get("record") ?? "").trim();
    if (!/^\d+$/.test(crmid)) return null;
    const setype = (u.searchParams.get("module") ?? "").trim();
    return { crmid, setype: /^[A-Za-z]{2,40}$/.test(setype) ? setype : "Accounts", origin };
  } catch { return null; }
}

/**
 * Formulário de Atendimento da EOX para qualificar a ligação (o mesmo link que a página da EOX monta ao fim da chamada).
 * Contato sem empresa vai em contact_id; os demais vão em parent_id.
 */
export function qualificationUrl(ref: EoxRef, pendingId: string): string {
  const contact = ref.setype === "Contacts";
  const q = new URLSearchParams({ module: "Atendimentos", view: "Edit", sourceuuid: pendingId, parent_id: contact ? "" : ref.crmid, campanha: "undefined", origem_atendimento: "Telefone Ativo", contact_id: contact ? ref.crmid : "0" });
  return `${ref.origin}/index.php?${q.toString().replace(/\+/g, "%20")}`;
}

/**
 * Link da qualificação quando a central avisou que existe uma (id_qualificacao_pendente = sourceuuid).
 * Sem cadastro conhecido a EOX abre o formulário sem empresa (parent_id vazio, nunca "undefined").
 */
export function qualificationLink(origin: string, ref: Pick<EoxRef, "crmid" | "setype"> | null, pendingId: string): string {
  const contact = ref?.setype === "Contacts";
  const q = new URLSearchParams({ module: "Atendimentos", view: "Edit", sourceuuid: pendingId, parent_id: ref && !contact ? ref.crmid : "", campanha: "undefined", origem_atendimento: "Telefone Ativo", contact_id: ref && contact ? ref.crmid : "0" });
  return `${origin}/index.php?${q.toString().replace(/\+/g, "%20")}`;
}

/** Os três lugares do cadastro na EOX (só muda o record). `origin` sem barra no fim. */
export function eoxPlaces(origin: string, record: string): { key: "perfil" | "atendimentos" | "conversas"; label: string; href: string }[] {
  const b = `${origin}/index.php?module=Accounts`;
  return [
    { key: "perfil", label: "Perfil", href: `${b}&view=Detail&record=${record}&referer=globalsearch` },
    { key: "atendimentos", label: "Atendimentos", href: `${b}&relatedModule=Atendimentos&view=Detail&record=${record}&mode=showRelatedList&tab_label=Atendimentos` },
    { key: "conversas", label: "Conversas", href: `${b}&relatedModule=PBXManager&view=Detail&record=${record}&mode=showRelatedList&tab_label=PBXManager` },
  ];
}
