"use client";

import { useState } from "react";
import { PermissionGrid } from "@/components/admin/permission-grid";
import { useRun } from "@/components/use-run";
import { btnPrimary, panelCls } from "@/components/ui";
import { saveRolePermissionsAction } from "@/modules/admin/config";

export function RolePermissions({ role, label, initial }: { role: "user" | "manager"; label: string; initial: Record<string, boolean> }) {
  const [v, setV] = useState(initial);
  const { run, pending } = useRun();
  return (
    <section className={`${panelCls} space-y-3 p-5`}>
      <h2 className="display text-xl">{label}</h2>
      <PermissionGrid mode="role" value={v} onChange={setV} />
      <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => saveRolePermissionsAction(role, v))}>Salvar {label}</button>
    </section>
  );
}
