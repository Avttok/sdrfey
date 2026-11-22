"use client";
import { TemplatesAdmin, type TplRow } from "@/components/admin/templates-admin";
export function MyTemplates({ rows, img }: { rows: TplRow[]; img?: { px: number; kb: number } }) { return <TemplatesAdmin rows={rows} mine img={img} />; }
