"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { useBusyWhile } from "./toast";
import { btnPrimary } from "./ui";

export function SubmitButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  useBusyWhile(pending);
  return (
    <button type="submit" disabled={pending} className={`${btnPrimary} ${className}`}>
      {pending && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
