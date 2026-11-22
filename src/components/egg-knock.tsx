"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { eggKnockAction } from "@/modules/easter/actions";

/** O "Made by" do rodapé: sete toques rápidos abrem uma porta. Fora isso, é só texto. */
export function EggKnock({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hits = useRef<number[]>([]);
  return (
    <span className="relative font-medium" onClick={() => {
      const n = Date.now();
      hits.current = [...hits.current.filter((t) => n - t < 3000), n];
      if (hits.current.length >= 7) { hits.current = []; void eggKnockAction().then((r) => { if (r.ok) router.push("/easter-egg"); }); }
    }}>{children}</span>
  );
}
