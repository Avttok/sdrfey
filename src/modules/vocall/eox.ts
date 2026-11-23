/** O VocallAgent precisa saber qual cadastro da EOX é a ligação (crmid + tipo), senão o formulário de Atendimento abre em branco. */
export type EoxRef = { crmid: string; setype: string };

/** Lê o link do cliente na EOX (…index.php?module=Accounts&view=Detail&record=1293925). null se não der para achar o cadastro. */
export function parseEoxUrl(url: string | null | undefined): EoxRef | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim(), "https://x.invalid");
    const crmid = (u.searchParams.get("record") ?? "").trim();
    if (!/^\d+$/.test(crmid)) return null;
    const setype = (u.searchParams.get("module") ?? "").trim();
    return { crmid, setype: /^[A-Za-z]{2,40}$/.test(setype) ? setype : "Accounts" };
  } catch { return null; }
}
