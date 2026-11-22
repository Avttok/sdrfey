"use server";

import { requireAdmin } from "@/modules/auth/guard";
import { dockCore, startCore, stopCore, tickCore, type DockData } from "./daemon-core";

export type { DockData };
export async function dockAction(): Promise<DockData> { return dockCore(await requireAdmin()); }
export async function daemonStartAction(scope: number | string = "new"): Promise<DockData> { return startCore(await requireAdmin(), scope); }
export async function daemonStopAction(): Promise<DockData> { return stopCore(await requireAdmin()); }
export async function daemonTickAction(): Promise<DockData & { go: boolean }> { return tickCore(await requireAdmin()); }
