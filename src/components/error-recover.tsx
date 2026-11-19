"use client";

import { useEffect } from "react";

const KEY = "sdrfey:err-reload";

/**
 * Erro de tela: quase sempre é a aba aberta num deploy antigo (arquivos que não existem mais).
 * Recarrega sozinho uma vez; se o erro continuar, mostra a tela com o botão de tentar de novo.
 */
export function ErrorRecover({ reset, dark = false }: { reset?: () => void; dark?: boolean }) {
  useEffect(() => {
    try {
      const last = Number(sessionStorage.getItem(KEY) ?? 0);
      if (Date.now() - last > 20_000) { sessionStorage.setItem(KEY, String(Date.now())); window.location.reload(); }
    } catch { /* sem sessionStorage: só mostra a tela */ }
  }, []);
  return (
    <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "system-ui, sans-serif", color: dark ? "#eee" : "inherit" }}>
      <div style={{ maxWidth: 380, textAlign: "center" }}>
        <p style={{ fontSize: 40, margin: 0 }}>⚠️</p>
        <h1 style={{ fontSize: 22, margin: "8px 0" }}>Atualizando o sistema…</h1>
        <p style={{ opacity: 0.7, margin: "0 0 16px", fontSize: 14 }}>Uma versão nova acabou de sair. Se a tela não voltar sozinha, toque em recarregar.</p>
        <button type="button" onClick={() => { try { sessionStorage.removeItem(KEY); } catch { /* ok */ } if (reset) reset(); window.location.reload(); }} style={{ padding: "10px 18px", borderRadius: 12, border: "1px solid #8884", background: "transparent", color: "inherit", fontWeight: 600, cursor: "pointer" }}>Recarregar</button>
      </div>
    </div>
  );
}
