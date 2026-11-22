"use client";
import { TemplatesAdmin, type TplRow } from "@/components/admin/templates-admin";
export function MyTemplates({ rows }: { rows: TplRow[] }) { return <TemplatesAdmin rows={rows} mine />; }
