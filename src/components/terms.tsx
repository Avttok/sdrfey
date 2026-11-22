"use client";

import { createContext, useContext } from "react";
import { applyTerm, type TermOverrides } from "@/config/terms";

const Ctx = createContext<TermOverrides>({});

/** Entrega os apelidos do Glossário (salvos pelo Adm) a toda a tela. */
export function TermsProvider({ value, children }: { value: TermOverrides; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** `const t = useT(); t("Shuffler Vendas")` devolve o apelido, se o Adm trocou o nome. */
export function useT() {
  const o = useContext(Ctx);
  return (text: string) => applyTerm(text, o);
}

/** Texto que respeita o Glossário: `<Term>Metas</Term>`. */
export function Term({ children }: { children: string }) {
  return <>{useT()(children)}</>;
}
