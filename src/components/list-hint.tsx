import { ArrowRight, Crosshair } from "lucide-react";
import Link from "next/link";

/** Sugestão para quem ainda não tem lista ativa no shuffler: levar à criação de uma lista. */
export function ListHint({ href }: { href: string }) {
  return (
    <div className="fx-rise relative mx-auto mt-5 flex w-full max-w-xl flex-wrap items-center gap-4 overflow-hidden rounded-3xl border border-accent/30 bg-accent/10 p-4 text-left">
      <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-grad text-on-accent shadow-lg shadow-accent/30"><Crosshair size={22} /></span>
      <p className="min-w-0 flex-1 text-sm"><b className="block text-base">Quer mais precisão na sua consulta?</b><span className="text-muted">Crie uma lista shuffler agora e sorteie só os leads que importam para você.</span></p>
      <Link href={href} className="hint-pulse group inline-flex items-center gap-2 rounded-2xl bg-grad px-4 py-2.5 text-sm font-bold text-on-accent shadow-lg shadow-accent/30 transition hover:brightness-110">Criar lista <ArrowRight size={16} aria-hidden className="transition group-hover:translate-x-1" /></Link>
    </div>
  );
}
