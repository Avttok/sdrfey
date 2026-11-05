"use client";

import { useState } from "react";
import { DateInput } from "@/components/date-input";

/** Campo de data (DD/MM/AAAA) para formulários comuns: envia AAAA-MM-DD no campo `name`. */
export function DateField({ name, label, defaultValue = "" }: { name: string; label: string; defaultValue?: string }) {
  const [v, setV] = useState(defaultValue);
  return <><DateInput label={label} value={v} onChange={setV} /><input type="hidden" name={name} value={v} /></>;
}
