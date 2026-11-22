"use client";

import { AlertTriangle, ArrowDown, ArrowUp, Plus, Save, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { GOALS, MOOD_KEYS, moodOf, OUTCOMES, SEGMENTS, type ScriptDoc, type ScriptGoal, type ScriptNode } from "@/config/scripts";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { useRun } from "@/components/use-run";
import { saveScriptAction } from "@/modules/scripts/actions";
import { unreachable } from "@/modules/scripts/schema";
import { ScriptPlayer } from "./script-player";
import { MOODS } from "./script-theme";

const newId = (nodes: ScriptNode[]) => { let i = nodes.length + 1; while (nodes.some((n) => n.id === `p${i}`)) i++; return `p${i}`; };
export const blankScript = (goal: ScriptGoal = "sdr"): ScriptDoc => ({ id: 0, title: "", segment: "geral", goal, summary: null, startId: "p1", global: false, mine: true, active: true, nodes: [{ id: "p1", type: "fala", title: "Abertura", say: "Bom dia! Aqui é {meunome}, da Fey. Falo com {contato} da {empresa}?", options: [{ label: "Atendeu", to: "p2", kind: "ok" }], tip: "" }, { id: "p2", type: "fim", title: "Fim", say: "Registre o resultado.", options: [], outcome: "encerrar" }] });

export function ScriptEditor({ initial, isAdmin, onClose }: { initial: ScriptDoc; isAdmin: boolean; onClose: () => void }) {
  const [d, setD] = useState<ScriptDoc>(initial);
  const [test, setTest] = useState(false);
  const { run, pending } = useRun();
  const lost = useMemo(() => unreachable(d.nodes, d.startId), [d.nodes, d.startId]);
  const setNode = (i: number, patch: Partial<ScriptNode>) => setD((c) => ({ ...c, nodes: c.nodes.map((n, k) => (k === i ? { ...n, ...patch } : n)) }));
  const move = (i: number, dir: -1 | 1) => setD((c) => { const a = [...c.nodes]; const j = i + dir; if (j < 0 || j >= a.length) return c; [a[i], a[j]] = [a[j], a[i]]; return { ...c, nodes: a }; });
  const remove = (i: number) => setD((c) => {
    const gone = c.nodes[i].id;
    const nodes = c.nodes.filter((_, k) => k !== i).map((n) => ({ ...n, options: n.options.map((o) => (o.to === gone ? { ...o, to: null } : o)) }));
    return { ...c, nodes, startId: c.startId === gone ? nodes[0]?.id ?? "" : c.startId };
  });
  const save = () => run(() => saveScriptAction({ id: d.id || undefined, title: d.title, segment: d.segment, goal: d.goal, summary: d.summary, startId: d.startId, nodes: d.nodes, global: d.global, active: d.active }), undefined, onClose);

  return (
    <div className="space-y-4">
      <div className={`${panelCls} space-y-3 p-4`}>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-sm sm:col-span-3">Nome do script<input className={inputCls} value={d.title} maxLength={80} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Ex.: Prospecção · Posto de molas" /></label>
          <label className="text-sm">Objetivo<select className={inputCls} value={d.goal} onChange={(e) => setD({ ...d, goal: e.target.value as ScriptGoal })}>{(Object.keys(GOALS) as ScriptGoal[]).map((k) => <option key={k} value={k}>{GOALS[k].label}</option>)}</select></label>
          <label className="text-sm">Tipo de estabelecimento<select className={inputCls} value={d.segment} onChange={(e) => setD({ ...d, segment: e.target.value })}>{Object.entries(SEGMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-sm">Começa no passo<select className={inputCls} value={d.startId} onChange={(e) => setD({ ...d, startId: e.target.value })}>{d.nodes.map((n) => <option key={n.id} value={n.id}>{n.title || n.id}</option>)}</select></label>
        </div>
        <p className="text-xs text-muted">Use {"{empresa}"}, {"{contato}"}, {"{cidade}"} e {"{meunome}"} nas falas: o sistema troca pelos dados do lead.</p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} /> Ativo</label>
          {isAdmin && <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={d.global} disabled={d.id !== 0} onChange={(e) => setD({ ...d, global: e.target.checked })} /> Script do time (todos veem)</label>}
        </div>
      </div>

      {lost.length > 0 && <p className="flex items-start gap-2 rounded-xl bg-warn/10 px-3 py-2 text-sm"><AlertTriangle size={16} aria-hidden className="mt-0.5 shrink-0 text-warn" /> Estes passos não são alcançados por nenhuma resposta: {lost.join(", ")}.</p>}

      <ol className="space-y-3">
        {d.nodes.map((n, i) => (
          <li key={n.id} className={`${panelCls} space-y-2 p-4`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-grad-soft text-xs font-bold text-accent">{i + 1}</span>
              <input aria-label="Nome do passo" className={`${inputCls} !w-auto min-w-0 flex-1`} value={n.title} maxLength={60} onChange={(e) => setNode(i, { title: e.target.value })} />
              <select aria-label="Tipo do passo" className={`${inputCls} !w-auto`} value={n.type} onChange={(e) => setNode(i, e.target.value === "fim" ? { type: "fim", options: [], outcome: n.outcome ?? "encerrar" } : { type: "fala", outcome: undefined })}><option value="fala">Fala (com respostas)</option><option value="fim">Fim (resultado)</option></select>
              <select aria-label="Papel do passo" title="Define o ícone e a cor deste passo na ligação" className={`${inputCls} !w-auto`} value={moodOf(n)} onChange={(e) => setNode(i, { mood: e.target.value as ScriptNode["mood"] })}>{MOOD_KEYS.map((k) => <option key={k} value={k}>{MOODS[k].label}</option>)}</select>
              <button type="button" aria-label="Subir" className={btnGhost} onClick={() => move(i, -1)}><ArrowUp size={15} /></button>
              <button type="button" aria-label="Descer" className={btnGhost} onClick={() => move(i, 1)}><ArrowDown size={15} /></button>
              <button type="button" aria-label="Excluir passo" className={`${btnGhost} text-danger`} disabled={d.nodes.length <= 1} onClick={() => remove(i)}><Trash2 size={15} /></button>
            </div>
            <textarea aria-label="Fala" rows={3} maxLength={1500} className={inputCls} value={n.say} onChange={(e) => setNode(i, { say: e.target.value })} placeholder="O que você diz ao lead, do jeito que falaria (sem instruções aqui: elas vão na dica)" />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-semibold text-muted">Mesma fala no tom Formal (opcional)<textarea aria-label="Fala no tom formal" rows={3} maxLength={1500} className={`${inputCls} font-normal`} value={n.v?.formal ?? ""} onChange={(e) => setNode(i, { v: { ...n.v, formal: e.target.value } })} placeholder="Vazio = usa a fala normal" /></label>
              <label className="space-y-1 text-xs font-semibold text-muted">Mesma fala no tom Solto (opcional)<textarea aria-label="Fala no tom solto" rows={3} maxLength={1500} className={`${inputCls} font-normal`} value={n.v?.solto ?? ""} onChange={(e) => setNode(i, { v: { ...n.v, solto: e.target.value } })} placeholder="Vazio = usa a fala normal" /></label>
            </div>
            <input aria-label="Dica" className={inputCls} value={n.tip ?? ""} maxLength={400} onChange={(e) => setNode(i, { tip: e.target.value })} placeholder="Dica só para quem lê, não é falada (opcional)" />
            {n.type === "fim" ? (
              <label className="text-sm">Resultado<select className={inputCls} value={n.outcome ?? "encerrar"} onChange={(e) => setNode(i, { outcome: e.target.value as ScriptNode["outcome"] })}>{Object.entries(OUTCOMES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted">Respostas que o lead pode dar</p>
                {n.options.map((o, k) => (
                  <div key={k} className="flex flex-wrap items-center gap-1.5">
                    <input aria-label="Resposta" className={`${inputCls} !w-auto min-w-0 flex-1`} value={o.label} maxLength={120} onChange={(e) => setNode(i, { options: n.options.map((x, j) => (j === k ? { ...x, label: e.target.value } : x)) })} />
                    <select aria-label="Tipo da resposta" className={`${inputCls} !w-auto`} value={o.kind} onChange={(e) => setNode(i, { options: n.options.map((x, j) => (j === k ? { ...x, kind: e.target.value as typeof o.kind } : x)) })}><option value="ok">Bom sinal</option><option value="objecao">Objeção</option><option value="neutro">Neutro</option></select>
                    <select aria-label="Vai para" className={`${inputCls} !w-auto`} value={o.to ?? ""} onChange={(e) => setNode(i, { options: n.options.map((x, j) => (j === k ? { ...x, to: e.target.value || null } : x)) })}><option value="">→ escolha o passo</option>{d.nodes.filter((m) => m.id !== n.id).map((m) => <option key={m.id} value={m.id}>→ {m.title || m.id}</option>)}</select>
                    <input aria-label="Anotação automática" title="Texto que vai para a observação do atendimento quando esta resposta é escolhida" placeholder="Anotar na observação (opcional)" className={`${inputCls} !w-full sm:!w-56`} value={o.note ?? ""} maxLength={160} onChange={(e) => setNode(i, { options: n.options.map((x, j) => (j === k ? { ...x, note: e.target.value || undefined } : x)) })} />
                    <button type="button" aria-label="Remover resposta" className={`${btnGhost} text-danger`} onClick={() => setNode(i, { options: n.options.filter((_, j) => j !== k) })}><X size={14} /></button>
                  </div>
                ))}
                {n.options.length < 10 && <button type="button" className={btnGhost} onClick={() => setNode(i, { options: [...n.options, { label: "", to: null, kind: "neutro" }] })}><Plus size={14} aria-hidden /> Resposta</button>}
              </div>
            )}
          </li>
        ))}
      </ol>
      {d.nodes.length < 60 && <button type="button" className={btnGhost} onClick={() => setD((c) => ({ ...c, nodes: [...c.nodes, { id: newId(c.nodes), type: "fala", title: "Novo passo", say: "", options: [] }] }))}><Plus size={15} aria-hidden /> Novo passo</button>}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} disabled={pending} onClick={save}><Save size={15} aria-hidden /> Salvar script</button>
        <button type="button" className={btnGhost} onClick={() => setTest(!test)}>{test ? "Fechar teste" : "Testar o roteiro"}</button>
        <button type="button" className={btnGhost} onClick={onClose}>Cancelar</button>
      </div>
      {test && <div className={`${panelCls} p-4`}><ScriptPlayer script={d} vars={{ empresa: "Auto Peças Modelo", contato: "Carlos", cidade: "Campinas", meunome: "Você" }} /></div>}
    </div>
  );
}
