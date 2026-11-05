import { Spinner } from "@/components/spinner";

/** Aparece sozinho enquanto uma aba nova carrega, para a tela nunca ficar parada sem explicação. */
export default function Loading() {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-32 text-muted">
      <Spinner size={32} className="text-accent" />
      <span className="text-sm">Carregando…</span>
    </div>
  );
}
