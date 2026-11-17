import type { PermissionMap } from "@/config/permissions";

/** "all" = altera a meta global e a de qualquer pessoa; "own" = só a própria; null = não altera. */
export type GoalScope = "all" | "own" | null;
export const goalScope = (p: PermissionMap): GoalScope => (p["goals.edit"] ? "all" : p["goals.edit.own"] ? "own" : null);
