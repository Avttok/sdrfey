"use client";

import { Merge } from "lucide-react";
import Link from "next/link";
import { useRun } from "@/components/use-run";
import { btnGhost, panelCls } from "@/components/ui";
import { mergeContactsAction, type DupGroup } from "@/modules/facts/contacts";

export function DuplicatesAdmin({ groups }: { groups: DupGroup[] }) {
  const { run, pending } = useRun();
  if (!groups.length) return <p className={`${panelCls} p-5 text-sm text-muted`}>Nenhum contato repetido por aqui. Tudo certo!</p>;
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <section key={g.leadId} className={`${panelCls} space-y-2 p-4`}>
          <p className="flex flex-wrap items-center gap-2 text-sm font-bold">{g.company}<Link className="text-xs font-normal text-accent hover:underline" href={`/leads/${g.leadId}`}>abrir lead</Link></p>
          <ul className="space-y-1.5">{g.people.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-sunk/50 px-3 py-2 text-sm">
              <b>{p.name}</b>{p.roleTitle && <span className="text-muted">{p.roleTitle}</span>}
              <span className="text-xs text-muted">{p.phones.length} tel · {p.emails.length} e-mail · {p.facts} dados</span>
              <span className="ml-auto flex flex-wrap gap-1.5">{g.people.filter((o) => o.id !== p.id).map((o) => (
                <button key={o.id} type="button" disabled={pending} className={`${btnGhost} !min-h-8 !px-2.5 !text-xs`} onClick={() => run(() => mergeContactsAction(p.id, o.id), undefined, () => location.reload())}><Merge size={12} aria-hidden /> Manter este e juntar “{o.name}”</button>
              ))}</span>
            </li>
          ))}</ul>
        </section>
      ))}
    </div>
  );
}
