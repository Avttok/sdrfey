/** Preferência "efeitos dourados" (por navegador). Ligada por padrão. */
const KEY = "gold-fx-off";
export const goldFxOff = (): boolean => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
export function setGoldFxOff(off: boolean): void {
  try { if (off) localStorage.setItem(KEY, "1"); else localStorage.removeItem(KEY); } catch { /* ignora */ }
  window.dispatchEvent(new Event("gold-fx"));
}
