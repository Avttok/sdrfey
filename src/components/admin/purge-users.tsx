"use client";

import { Trash2, UserX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnGhost, panelCls } from "@/components/ui";
import { purgeUserDataAction } from "@/modules/admin/purge";
import type { UserPurgeRow } from "@/modules/admin/purge-data";
import { CONFIRM_WORD, USER_PURGE, type UserPurgeKey } from "@/modules/admin/purge-spec";
import { TypedConfirm } from "./purge-confirm";

type Target = { user: UserPurgeRow; what: UserPurgeKey | "all" };
const nf = (n: number) => n.toLocaleString("pt-BR");

export function PurgeUsers({ rows }: { rows: UserPurgeRow[] }) {
  const router = useRouter();
  const { run, pending } = useRun();
  const [target, setTarget] = useState<Target | null>(null);
  const label = target ? (target.what === "all" ? "tudo de" : USER_PURGE.find((k) => k.key === target.what)!.label.toLowerCase() + " de") : "";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Apague o que cada pessoa produziu, uma coisa por vez ou tudo. A conta continua; para excluir a conta use <Link href="/admin/usuarios" className="font-medium text-accent underline-offset-2 hover:underline">Usuários</Link>.</p>
      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map((u) => {
          const total = Object.values(u.counts).reduce((a, b) => a + b, 0);
          return (
            <article key={u.id} className={`${panelCls} space-y-3 p-4`}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="min-w-0 flex-1 truncate font-semibold">{u.name} <span className="text-sm font-normal text-muted">@{u.username}</span></h3>
                {!u.active && <span className="rounded-full bg-sunk px-2 py-0.5 text-xs text-muted">bloqueado</span>}
                <span className="rounded-full bg-sunk px-2 py-0.5 text-xs text-muted">{u.roles.join(" · ")}</span>
              </div>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {USER_PURGE.map((k) => (
                  <li key={k.key} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 text-sm" title={k.hint}>{k.label}</span>
                    <span className="figure w-14 text-right text-sm font-semibold tabular-nums">{nf(u.counts[k.key])}</span>
                    <button type="button" className="grid size-9 place-items-center rounded-lg text-danger transition-colors hover:bg-danger/10 disabled:opacity-30 disabled:hover:bg-transparent" disabled={pending || u.counts[k.key] === 0} aria-label={`Apagar ${k.label.toLowerCase()} de ${u.name}`} onClick={() => setTarget({ user: u, what: k.key })}><Trash2 size={16} aria-hidden /></button>
                  </li>
                ))}
              </ul>
              <button type="button" className={`${btnGhost} w-full !border-danger/50 text-danger`} disabled={pending || total === 0} onClick={() => setTarget({ user: u, what: "all" })}><UserX size={15} aria-hidden /> Apagar tudo de {u.name.split(" ")[0]} ({nf(total)})</button>
            </article>
          );
        })}
      </div>
      <TypedConfirm open={!!target} word={CONFIRM_WORD} busy={pending} label="Apagar definitivamente" title={target ? `Apagar ${label} ${target.user.name}?` : ""} onCancel={() => setTarget(null)}
        onConfirm={(typed) => { const t = target!; setTarget(null); run(() => purgeUserDataAction({ userId: t.user.id, what: t.what, confirm: typed }), undefined, () => router.refresh(), "Apagando…"); }}>
        {target && (<>
          <p>{target.what === "all" ? `Interações, atendimentos, visitas, negociações (como SDR e como vendedor), mensagens do chat e o registro de atividades de ${target.user.name} serão apagados.` : `Os registros serão apagados só de ${target.user.name}; os dos outros ficam.`}</p>
          {(target.what === "dealsSdr" || target.what === "dealsSeller" || target.what === "all") && <p className="text-warn">Negociações levam junto as cotações e os andamentos. Os leads continuam cadastrados.</p>}
          <p>Não dá para desfazer. Fica um registro desta exclusão em Registro.</p>
        </>)}
      </TypedConfirm>
    </div>
  );
}
