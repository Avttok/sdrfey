"use client";

import { useBusyWhile } from "@/components/toast";
import { Eye, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setAdminViewAction } from "@/modules/auth/view-mode";

/** Só o Adm vê: liga/desliga "ver tudo como Adm". Desligado, as telas mostram só o que um usuário comum com os seus cargos veria. */
export function AdminViewSwitch({ mode }: { mode: "all" | "me" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  useBusyWhile(pending);
  const [cur, setCur] = useState(mode);
  const all = (pending ? cur : mode) === "all";
  const toggle = () => { const next = all ? "me" : "all"; setCur(next); start(async () => { await setAdminViewAction(next); router.refresh(); }); };
  return (
    <button type="button" role="switch" aria-checked={all} onClick={toggle} disabled={pending} title={all ? "Vendo tudo como Adm. Clique para ver só as suas coisas, como um usuário comum (os privilégios de Adm continuam)." : "Vendo como usuário comum. Clique para ver tudo como Adm."}
      className={`group inline-flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-semibold transition disabled:opacity-70 ${all ? "border-accent/40 bg-grad-soft text-accent" : "border-line bg-sunk text-muted hover:text-ink"}`}>
      <span className={`relative h-5 w-9 rounded-full transition ${all ? "bg-grad" : "bg-line"}`}><span className={`absolute top-0.5 grid size-4 place-items-center rounded-full bg-white text-ink shadow transition-all ${all ? "left-[1.1rem]" : "left-0.5"}`}>{all ? <ShieldCheck size={10} aria-hidden /> : <UserRound size={10} aria-hidden />}</span></span>
      <span className="hidden xl:inline"><Eye size={12} className="mr-1 inline" aria-hidden />{all ? "Vendo como Adm" : "Vendo como usuário"}</span>
    </button>
  );
}
