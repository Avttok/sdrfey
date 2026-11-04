import { eq } from "drizzle-orm";
import { RolePermissions } from "@/components/admin/role-permissions";
import { PERMISSIONS, type RoleOverrides } from "@/config/permissions";
import { db, settings } from "@/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [row] = await db.select().from(settings).where(eq(settings.key, "role_permissions"));
  const o = (row?.value ?? {}) as RoleOverrides;
  const initial = (r: "user" | "manager") => Object.fromEntries(PERMISSIONS.map((p) => [p.key, o[r]?.[p.key] ?? p.defaults.includes(r)]));
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">O que cada cargo vê por padrão. Quem tem os dois cargos recebe o que qualquer um libera. Ajustes por pessoa ficam em Usuários. O Adm sempre vê tudo.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <RolePermissions role="user" label="Usuário" initial={initial("user")} />
        <RolePermissions role="manager" label="Gestor" initial={initial("manager")} />
      </div>
    </div>
  );
}
