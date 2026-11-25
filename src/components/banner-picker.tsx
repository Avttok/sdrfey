"use client";

import { useState } from "react";
import { BannerGrid } from "@/components/banner-grid";
import { useRun } from "@/components/use-run";
import { setBannerAction } from "@/modules/users/actions";

/** Escolha do banner do perfil em Minha conta. */
export function BannerPicker({ current, earned = [], ownedShop = [] }: { current: string | null; earned?: readonly string[]; ownedShop?: readonly string[] }) {
  const [sel, setSel] = useState(current);
  const { run, pending } = useRun();
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Banner do perfil</p>
      <BannerGrid earned={earned} ownedShop={ownedShop} value={sel} disabled={pending} onPick={(k) => { setSel(k); void run(() => setBannerAction(k)); }} />
    </div>
  );
}
