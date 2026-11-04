import { CircleAlert, CircleCheck } from "lucide-react";
import type { FormState } from "@/modules/auth/actions";

/** Mostra o erro ou o sucesso devolvido por uma ação de formulário. */
export function FormMessage({ state }: { state: FormState }) {
  if (!state.error && !state.ok) return null;
  const isError = !!state.error;
  const Icon = isError ? CircleAlert : CircleCheck;
  return (
    <p
      role={isError ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
        isError ? "border-danger/40 bg-danger/10 text-danger" : "border-ok/40 bg-ok/10 text-ok"
      }`}
    >
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
      <span>{state.error ?? state.ok}</span>
    </p>
  );
}
