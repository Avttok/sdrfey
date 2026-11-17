"use client";

import { Building2, EllipsisVertical, ExternalLink, FileText, Handshake, Loader2, MessageCircle, Paperclip, Search, Send, SmilePlus, Trash2, WifiOff, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { RoleBadge } from "@/components/role-badge";
import { REACTION_EMOJIS } from "@/modules/chat/channels";
import type { ChatMsg, Reaction } from "@/modules/chat/data";
import { adminChatPurgeAction, chatProfileAction, deleteChatMessageAction, searchShareAction, sendChatMessageAction, sharedInfoAction, toggleReactionAction, type ChatProfile } from "@/modules/chat/actions";
import type { ShareInfo, ShareItem, ShareKind } from "@/modules/chat/share";

import { ROLE_META, type Role } from "@/config/roles";
const ROLE_RANK: Record<Role, number> = { user: 1, seller: 1, manager: 2, admin: 3 };
const ROLE_DOT: Record<Role, string> = { user: "#3b82f6", seller: "#22c55e", manager: "#eab308", admin: "#ef4444" };
type Channel = { key: string; label: string; hint: string };
type Picked = { kind: ShareKind; id: number; label: string };

const KIND_META: Record<ShareKind, { label: string; Icon: typeof Building2 }> = {
  lead: { label: "Lead / cliente", Icon: Building2 },
  deal: { label: "Negociação", Icon: Handshake },
  quote: { label: "Cotação", Icon: FileText },
};
const hm = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long" });
const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
const initials = (n: string) => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/** Janela com o item compartilhado: só leitura. Gestor/Adm tem o link da página completa (o Adm edita lá). */
function InfoDialog({ messageId, onClose }: { messageId: number; onClose: () => void }) {
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [err, setErr] = useState("");
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    let live = true;
    sharedInfoAction(messageId).then((r) => { if (!live) return; if (r.ok) setInfo(r.info); else setErr(r.message); }).catch(() => live && setErr("Não consegui abrir agora."));
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", key);
    return () => { live = false; document.removeEventListener("keydown", key); };
  }, [messageId]);
  const Icon = info ? KIND_META[info.kind].Icon : Building2;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Item compartilhado" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[88vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl border border-line bg-panel p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-grad-soft text-accent"><Icon size={20} aria-hidden /></span>
          <div className="min-w-0 flex-1"><h2 className="display break-words text-xl">{info?.title ?? "Carregando…"}</h2>{info?.subtitle && <p className="text-xs text-muted">{info.subtitle}</p>}</div>
          <button type="button" aria-label="Fechar" className="rounded-lg p-1.5 hover:bg-sunk" onClick={onClose}><X size={18} /></button>
        </div>
        {!info && !err && <p className="flex items-center gap-2 text-sm text-muted"><Loader2 size={16} className="animate-spin" aria-hidden /> Carregando…</p>}
        {err && <p className="text-sm text-danger">{err}</p>}
        {info?.gone && <p className="text-sm text-muted">Esse item foi removido do sistema.</p>}
        {info && !info.gone && (
          <>
            <dl className="grid gap-2 sm:grid-cols-2">
              {info.rows.map((r) => <div key={r.label} className="min-w-0 rounded-xl bg-sunk px-3.5 py-2.5"><dt className="text-xs text-muted">{r.label}</dt><dd className="mt-0.5 break-words text-sm font-medium">{r.value}</dd></div>)}
            </dl>
            {info.items && info.items.length > 0 && (
              <div><h3 className="mb-1.5 text-sm font-semibold">Itens</h3><ul className="divide-y divide-line rounded-xl border border-line text-sm">{info.items.map((i, k) => <li key={k} className="flex items-start justify-between gap-3 px-3 py-2"><span className="min-w-0 break-words">{i.text}</span><span className="figure shrink-0 font-medium">{i.value}</span></li>)}</ul></div>
            )}
            <p className="text-xs text-muted">Informações do momento, somente leitura.</p>
            {info.href && <Link href={info.href} onClick={onClose} className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"><ExternalLink size={14} aria-hidden /> {info.editable ? "Abrir a página completa para editar" : "Abrir a página completa"}</Link>}
          </>
        )}
      </div>
    </div>
  );
}

/** Escolha do que compartilhar: tipo + busca. */
function SharePicker({ onPick, onClose }: { onPick: (p: Picked) => void; onClose: () => void }) {
  const [kind, setKind] = useState<ShareKind>("lead");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ShareItem[] | null>(null);
  useEffect(() => {
    let live = true;
    setItems(null);
    const t = setTimeout(() => { searchShareAction(kind, q).then((r) => { if (live) setItems(r.ok ? r.items : []); }).catch(() => live && setItems([])); }, q ? 250 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [kind, q]);
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex max-h-[85%] flex-col rounded-t-2xl border-t border-line bg-panel shadow-2xl">
      <div className="flex items-center gap-2 px-3 pt-3">
        <p className="flex-1 text-sm font-semibold">Compartilhar no chat</p>
        <button type="button" aria-label="Fechar" className="rounded-lg p-1.5 hover:bg-sunk" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="flex gap-1 px-3 pt-2" role="tablist">
        {(Object.keys(KIND_META) as ShareKind[]).map((k) => <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${kind === k ? "bg-grad-soft text-accent" : "text-muted hover:bg-sunk"}`}>{KIND_META[k].label}</button>)}
      </div>
      <label className="relative mx-3 mt-2 block"><Search size={14} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={kind === "lead" ? "Empresa ou CNPJ" : "Empresa ou número da cotação"} className="w-full rounded-xl border border-line bg-sunk py-2 pl-8 pr-3 text-sm outline-none focus:border-accent" /></label>
      <ul className="min-h-24 flex-1 space-y-1 overflow-y-auto p-3">
        {items === null && <li className="flex items-center gap-2 text-sm text-muted"><Loader2 size={14} className="animate-spin" aria-hidden /> Pesquisando…</li>}
        {items?.length === 0 && <li className="text-sm text-muted">Nada encontrado que você possa compartilhar.</li>}
        {items?.map((i) => <li key={i.id}><button type="button" className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-sunk" onClick={() => onPick({ kind, id: i.id, label: i.label })}><span className="block truncate text-sm font-medium">{i.label}</span><span className="block truncate text-xs text-muted">{i.sub}</span></button></li>)}
      </ul>
    </div>
  );
}

const dtFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

/** Perfil de quem está no chat. O Adm ainda vê situação e último acesso, e pode apagar as mensagens da pessoa. */
function ProfileDialog({ userId, hex, isAdmin, onClose, onPurged }: { userId: number; hex: string; isAdmin: boolean; onClose: () => void; onPurged: () => void }) {
  const toast = useToast();
  const [p, setP] = useState<ChatProfile | null>(null);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(false);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    let live = true;
    chatProfileAction(userId).then((r) => { if (!live) return; if (r.ok) setP(r.profile); else setErr(r.message); }).catch(() => live && setErr("Não consegui abrir agora."));
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", key);
    return () => { live = false; document.removeEventListener("keydown", key); };
  }, [userId]);
  const purge = async () => {
    const r = await adminChatPurgeAction({ userId }).catch(() => null);
    if (!r || !r.ok) return toast("bad", r && !r.ok ? r.message : "Não consegui apagar.");
    toast("ok", `${r.removed} mensagens apagadas.`); onPurged(); onClose();
  };
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Perfil" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-panel p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="grid size-14 shrink-0 place-items-center rounded-full text-lg font-bold text-white" style={{ background: hex }}>{p ? initials(p.name) : "…"}</span>
          <div className="min-w-0 flex-1"><h2 className="display break-words text-xl">{p?.name ?? "Carregando…"}</h2>{p && <p className="text-xs text-muted">@{p.username}</p>}</div>
          <button type="button" aria-label="Fechar" className="rounded-lg p-1.5 hover:bg-sunk" onClick={onClose}><X size={18} /></button>
        </div>
        {err && <p className="text-sm text-danger">{err}</p>}
        {p && (
          <>
            <div className="flex flex-wrap gap-1.5">{p.roles.map((r) => <RoleBadge key={r} role={r} />)}</div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-sunk px-3 py-2"><dt className="text-xs text-muted">Mensagens no chat</dt><dd className="figure font-semibold">{p.sent}</dd></div>
              {p.isAdminView && <div className="rounded-xl bg-sunk px-3 py-2"><dt className="text-xs text-muted">Conta</dt><dd className="font-semibold">{p.active ? "Ativa" : "Bloqueada"}</dd></div>}
              {p.isAdminView && <div className="col-span-2 rounded-xl bg-sunk px-3 py-2"><dt className="text-xs text-muted">Último acesso</dt><dd className="font-semibold">{p.lastLoginAt ? dtFmt.format(new Date(p.lastLoginAt)) : "—"}</dd></div>}
            </dl>
            {isAdmin && (confirm
              ? <div className="flex flex-wrap items-center gap-2 rounded-xl border border-danger/50 bg-danger/5 p-3 text-sm"><span className="flex-1 font-medium text-danger">Apagar todas as mensagens de {p.name.split(" ")[0]}?</span><button type="button" className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white" onClick={purge}>Sim, apagar</button><button type="button" className="rounded-lg px-3 py-1.5 text-xs hover:bg-sunk" onClick={() => setConfirm(false)}>Cancelar</button></div>
              : <button type="button" className="flex items-center gap-1.5 text-sm font-medium text-danger hover:underline" onClick={() => setConfirm(true)}><Trash2 size={14} aria-hidden /> Apagar todas as mensagens desta pessoa</button>)}
          </>
        )}
      </div>
    </div>
  );
}

export function ChatWidget({ channels, meId, isAdmin, initialUnread }: { channels: Channel[]; meId: number; isAdmin: boolean; initialUnread: Record<string, number> }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState(channels[0].key);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [more, setMore] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [picker, setPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const [info, setInfo] = useState<number | null>(null);
  const [off, setOff] = useState(false);
  const [offline, setOffline] = useState(false);
  const [profile, setProfile] = useState<{ id: number; hex: string } | null>(null);
  const [pickFor, setPickFor] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const fails = useRef(0);
  const busy = useRef(false);
  const tick = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const msgsRef = useRef(msgs);
  msgsRef.current = msgs;
  const chRef = useRef(channel);
  chRef.current = channel;

  /** Uma consulta ao servidor. Nunca roda duas ao mesmo tempo; falhas viram aviso "sem conexão" e novas tentativas. */
  const poll = useCallback(async (reset = false): Promise<void> => {
    if (busy.current && !reset) return;
    busy.current = true;
    const ch = chRef.current;
    const cur = reset ? [] : msgsRef.current;
    const last = cur.length ? cur[cur.length - 1].id : 0;
    const u = new URLSearchParams();
    if (open) { u.set("channel", ch); u.set("open", "1"); if (last) { u.set("after", String(last)); if (tick.current++ % 2 === 0) u.set("from", String(cur[0].id)); } }
    try {
      const r = await fetch(`/api/chat?${u}`, { cache: "no-store" });
      if (r.status === 401) { fails.current = 99; setOffline(true); return; }
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { enabled: boolean; unread: Record<string, number>; messages: ChatMsg[]; gone: number[]; reactions: Record<number, Reaction[]> };
      fails.current = 0; setOffline(false);
      if (!j.enabled) { setOff(true); return; }
      setUnread(open ? { ...j.unread, [ch]: 0 } : j.unread);
      if (!open || chRef.current !== ch) return;
      if (reset) { setMsgs(j.messages); setMore(j.messages.length >= 40); setLoaded(true); }
      else {
        setMsgs((prev) => {
          const gone = new Set(j.gone); const seen = new Set(prev.map((m) => m.id));
          const next = [...prev.filter((m) => !gone.has(m.id)), ...j.messages.filter((m) => !seen.has(m.id))];
          const rx = j.reactions ?? {};
          return next.map((m) => (rx[m.id] ? { ...m, reactions: rx[m.id] } : m));
        });
      }
    } catch { fails.current += 1; if (fails.current >= 2) setOffline(true); }
    finally { busy.current = false; }
  }, [open]);

  // troca de canal / abertura: recarrega
  useEffect(() => { if (open) { setLoaded(false); setMsgs([]); stick.current = true; void poll(true); } }, [open, channel, poll]);
  // atualização contínua: rápida com o chat aberto, lenta fechado; pausa com a aba escondida; recua se o servidor falhar
  const pollRef = useRef(poll);
  pollRef.current = poll;
  useEffect(() => {
    let stop = false;
    let t: ReturnType<typeof setTimeout>;
    const next = () => (fails.current >= 99 ? 60000 : fails.current ? Math.min(15000, 2500 * 2 ** fails.current) : open ? 3000 : 20000);
    const loop = async () => { if (stop) return; if (!document.hidden) await pollRef.current(false); if (!stop) t = setTimeout(loop, next()); };
    t = setTimeout(loop, open ? 1500 : 20000);
    const vis = () => { if (!document.hidden) { clearTimeout(t); void loop(); } };
    document.addEventListener("visibilitychange", vis);
    return () => { stop = true; clearTimeout(t); document.removeEventListener("visibilitychange", vis); };
  }, [open]);
  useEffect(() => { const el = scroller.current; if (el && stick.current) el.scrollTop = el.scrollHeight; }, [msgs, loaded, open]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && info === null && !picker && !profile) setOpen(false); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open, info, picker, profile]);

  const loadOlder = async () => {
    const first = msgs[0]?.id;
    if (!first) return;
    const el = scroller.current; const prevH = el?.scrollHeight ?? 0;
    const r = await fetch(`/api/chat?channel=${channel}&before=${first}`, { cache: "no-store" });
    if (!r.ok) return;
    const j = (await r.json()) as { messages: ChatMsg[] };
    stick.current = false;
    setMsgs((p) => [...j.messages, ...p]); setMore(j.messages.length >= 40);
    requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevH; });
  };

  const send = async () => {
    if (sending || (!draft.trim() && !picked)) return;
    setSending(true);
    const r = await sendChatMessageAction({ channel, body: draft, share: picked ? { kind: picked.kind, id: picked.id } : null }).catch(() => null);
    setSending(false);
    if (!r) return toast("bad", "Não consegui enviar. Tente de novo.");
    if (!r.ok) return toast("bad", r.message);
    stick.current = true;
    setMsgs((p) => (p.some((m) => m.id === r.message.id) ? p : [...p, r.message]));
    setDraft(""); setPicked(null);
  };
  const del = async (id: number) => {
    const r = await deleteChatMessageAction(id).catch(() => null);
    if (!r || !r.ok) return toast("bad", r && !r.ok ? r.message : "Não consegui apagar.");
    setMsgs((p) => p.filter((m) => m.id !== id));
  };

  const react = async (id: number, emoji: string) => {
    setPickFor(null);
    // atualiza na hora; o servidor confirma no próximo ciclo
    setMsgs((p) => p.map((m) => {
      if (m.id !== id) return m;
      const ex = m.reactions.find((x) => x.emoji === emoji);
      let rs: Reaction[];
      if (ex?.mine) rs = m.reactions.map((x) => (x.emoji === emoji ? { ...x, count: x.count - 1, mine: false } : x)).filter((x) => x.count > 0);
      else if (ex) rs = m.reactions.map((x) => (x.emoji === emoji ? { ...x, count: x.count + 1, mine: true } : x));
      else rs = [...m.reactions, { emoji, count: 1, mine: true, names: [] }];
      return { ...m, reactions: rs };
    }));
    const r = await toggleReactionAction(id, emoji).catch(() => null);
    if (!r || !r.ok) { toast("bad", r && !r.ok ? r.message : "Não consegui reagir."); void poll(true); }
  };
  const clearChannel = async () => {
    const r = await adminChatPurgeAction({ channel }).catch(() => null);
    setConfirmClear(false); setMenu(false);
    if (!r || !r.ok) return toast("bad", r && !r.ok ? r.message : "Não consegui apagar.");
    toast("ok", `${r.removed} mensagens apagadas.`); void poll(true);
  };
  const total = useMemo(() => Object.values(unread).reduce((a, b) => a + b, 0), [unread]);
  if (off) return null;
  const rows: React.ReactNode[] = [];
  let lastDay = "", lastUser: number | null | undefined;
  for (const m of msgs) {
    const dk = dayKey(m.at);
    if (dk !== lastDay) { rows.push(<p key={`d${m.id}`} className="my-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted">{dayFmt.format(new Date(m.at))}</p>); lastDay = dk; lastUser = undefined; }
    const mine = m.userId === meId;
    const first = lastUser !== m.userId; lastUser = m.userId;
    const S = m.share ? KIND_META[m.share.kind] : null;
    rows.push(
      <div key={m.id} className={`group flex min-w-0 gap-2 ${mine ? "flex-row-reverse" : ""} ${first ? "mt-2" : ""}`}>
        {first ? <button type="button" disabled={!m.userId} onClick={() => m.userId && setProfile({ id: m.userId, hex: m.hex })} aria-label={`Perfil de ${m.name}`} className="grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white transition hover:scale-110" style={{ background: m.hex }} title={m.name}>{initials(m.name)}</button> : <span className="size-7 shrink-0" />}
        <div className={`flex min-w-0 max-w-[82%] flex-col ${mine ? "items-end" : "items-start"}`}>
          {first && <p className={`mb-0.5 flex flex-wrap items-center gap-1.5 px-1 text-[11px] text-muted ${mine ? "justify-end" : ""}`}><button type="button" disabled={!m.userId} onClick={() => m.userId && setProfile({ id: m.userId, hex: m.hex })} className="font-medium hover:text-ink hover:underline">{mine ? "Você" : m.name.split(" ")[0]}</button>{[...m.roles].sort((x, y) => ROLE_RANK[y] - ROLE_RANK[x]).slice(0, 2).map((r) => <span key={r} className="rounded-full border border-line bg-sunk px-1.5 py-px text-[10px] font-semibold text-ink"><span className="mr-1 inline-block size-1.5 rounded-full" style={{ background: ROLE_DOT[r] }} />{ROLE_META[r].label}</span>)}</p>}
          <div className={`min-w-0 max-w-full rounded-2xl px-3 py-2 text-sm ${mine ? "rounded-tr-md bg-accent text-on-accent" : "rounded-tl-md bg-sunk"}`}>
            {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
            {m.share && S && (
              <button type="button" onClick={() => setInfo(m.id)} className={`${m.body ? "mt-2" : ""} flex w-full min-w-0 items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${mine ? "border-white/30 bg-white/15 hover:bg-white/25" : "border-line bg-panel hover:border-accent/50"}`}>
                <S.Icon size={18} aria-hidden className="shrink-0" />
                <span className="min-w-0"><span className="block text-[11px] opacity-75">{S.label}</span><span className="block truncate text-sm font-semibold">{m.share.label}</span></span>
              </button>
            )}
          </div>
          {m.reactions.length > 0 && <div className={`mt-1 flex flex-wrap gap-1 ${mine ? "justify-end" : ""}`}>{m.reactions.map((x) => <button key={x.emoji} type="button" onClick={() => react(m.id, x.emoji)} title={x.names.join(", ")} aria-label={`${x.emoji} ${x.count}`} aria-pressed={x.mine} className={`figure rounded-full border px-1.5 py-0.5 text-xs transition ${x.mine ? "border-accent bg-accent/15" : "border-line bg-panel hover:border-accent/50"}`}>{x.emoji} {x.count}</button>)}</div>}
          {pickFor === m.id && <div className="mt-1 flex gap-0.5 rounded-full border border-line bg-panel p-1 shadow-lg">{REACTION_EMOJIS.map((e) => <button key={e} type="button" onClick={() => react(m.id, e)} className="rounded-full px-1.5 py-0.5 text-base transition hover:scale-125 hover:bg-sunk" aria-label={`Reagir com ${e}`}>{e}</button>)}</div>}
          <p className="mt-0.5 flex items-center gap-1.5 px-1 text-[10px] text-muted">{hm.format(new Date(m.at))}<button type="button" aria-label="Reagir" title="Reagir" onClick={() => setPickFor(pickFor === m.id ? null : m.id)} className="opacity-0 transition hover:text-accent focus:opacity-100 group-hover:opacity-100 max-lg:opacity-60"><SmilePlus size={12} /></button>{m.canDelete && <button type="button" aria-label="Apagar mensagem" title="Apagar" onClick={() => del(m.id)} className="opacity-0 transition hover:text-danger focus:opacity-100 group-hover:opacity-100 max-lg:opacity-60"><Trash2 size={11} /></button>}</p>
        </div>
      </div>,
    );
  }
  const cur = channels.find((c) => c.key === channel);
  return (
    <>
      {open && (
        <section aria-label="Chat" className="fixed inset-x-3 bottom-20 z-40 flex h-[min(34rem,calc(100dvh-7rem))] flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl sm:inset-x-auto sm:right-5 sm:w-[24rem]">
          <header className="flex items-center gap-2 border-b border-line px-4 py-3">
            <span className="grid size-8 place-items-center rounded-lg bg-grad-soft text-accent"><MessageCircle size={16} aria-hidden /></span>
            <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold leading-tight">Chat · {cur?.label}</h2><p className="truncate text-[11px] text-muted">{cur?.hint}</p></div>
            {isAdmin && (
              <div className="relative">
                <button type="button" aria-label="Opções do Adm" aria-expanded={menu} className="rounded-lg p-1.5 text-muted hover:bg-sunk" onClick={() => { setMenu(!menu); setConfirmClear(false); }}><EllipsisVertical size={17} /></button>
                {menu && (
                  <div role="menu" className="absolute right-0 top-9 z-20 w-60 space-y-1 rounded-xl border border-line bg-panel p-2 text-sm shadow-xl">
                    <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Controle do Adm</p>
                    {confirmClear
                      ? <div className="space-y-2 rounded-lg border border-danger/50 bg-danger/5 p-2"><p className="text-xs font-medium text-danger">Apagar TODAS as mensagens do grupo {cur?.label}? Não dá para desfazer.</p><div className="flex gap-2"><button type="button" className="rounded-lg bg-danger px-2.5 py-1 text-xs font-semibold text-white" onClick={clearChannel}>Sim, apagar</button><button type="button" className="rounded-lg px-2.5 py-1 text-xs hover:bg-sunk" onClick={() => setConfirmClear(false)}>Cancelar</button></div></div>
                      : <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-danger hover:bg-sunk" onClick={() => setConfirmClear(true)}><Trash2 size={14} aria-hidden /> Limpar o grupo {cur?.label}</button>}
                    <p className="px-2 text-[11px] text-muted">Para apagar uma mensagem, passe o mouse nela. Para apagar tudo de uma pessoa, abra o perfil dela.</p>
                  </div>
                )}
              </div>
            )}
            <button type="button" aria-label="Fechar chat" className="rounded-lg p-1.5 text-muted hover:bg-sunk" onClick={() => setOpen(false)}><X size={17} /></button>
          </header>
          {offline && <p role="status" className="flex items-center gap-2 bg-warn/15 px-4 py-1.5 text-xs font-medium text-warn"><WifiOff size={13} aria-hidden /> Sem conexão com o servidor. Tentando de novo…</p>}
          {channels.length > 1 && (
            <div role="tablist" aria-label="Grupos" className="flex gap-1 overflow-x-auto border-b border-line px-2 py-1.5">
              {channels.map((c) => (
                <button key={c.key} type="button" role="tab" aria-selected={channel === c.key} onClick={() => setChannel(c.key)} className={`relative shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${channel === c.key ? "bg-grad-soft text-accent" : "text-muted hover:bg-sunk hover:text-ink"}`}>
                  {c.label}{unread[c.key] ? <span className="figure ml-1.5 rounded-full bg-danger px-1.5 text-[10px] font-bold leading-4 text-white">{unread[c.key]}</span> : null}
                </button>
              ))}
            </div>
          )}
          <div ref={scroller} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {!loaded && <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted"><Loader2 size={15} className="animate-spin" aria-hidden /> Carregando…</p>}
            {loaded && more && <button type="button" onClick={loadOlder} className="mx-auto mb-2 block rounded-lg px-3 py-1 text-xs text-muted hover:bg-sunk">Ver mensagens anteriores</button>}
            {loaded && msgs.length === 0 && <p className="py-10 text-center text-sm text-muted">Nenhuma mensagem ainda. Comece a conversa!</p>}
            {rows}
          </div>
          <footer className="relative border-t border-line p-2.5">
            {picker && <SharePicker onClose={() => setPicker(false)} onPick={(p) => { setPicked(p); setPicker(false); }} />}
            {picked && (() => { const K = KIND_META[picked.kind]; return <div className="mb-2 flex items-center gap-2 rounded-xl bg-sunk px-3 py-1.5 text-xs"><K.Icon size={14} aria-hidden className="shrink-0 text-accent" /><span className="min-w-0 flex-1 truncate"><b>{K.label}:</b> {picked.label}</span><button type="button" aria-label="Remover anexo" onClick={() => setPicked(null)} className="rounded p-0.5 hover:bg-line"><X size={13} /></button></div>; })()}
            <div className="flex items-end gap-1.5">
              <button type="button" aria-label="Compartilhar lead, negociação ou cotação" title="Compartilhar" onClick={() => setPicker(true)} className="grid size-10 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-sunk hover:text-accent"><Paperclip size={18} aria-hidden /></button>
              <textarea value={draft} rows={1} maxLength={2000} placeholder="Escreva uma mensagem…" aria-label="Mensagem" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-line bg-sunk px-3 py-2 text-sm outline-none focus:border-accent" />
              <button type="button" aria-label="Enviar" disabled={sending || (!draft.trim() && !picked)} onClick={send} className="grid size-10 shrink-0 place-items-center rounded-xl bg-grad text-on-accent transition disabled:opacity-50">{sending ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <Send size={17} aria-hidden />}</button>
            </div>
          </footer>
        </section>
      )}
      <button type="button" aria-label={open ? "Fechar chat" : total ? `Abrir chat (${total} não lidas)` : "Abrir chat"} aria-expanded={open} onClick={() => setOpen(!open)} className="fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full bg-grad text-on-accent shadow-xl transition hover:scale-105 active:scale-95">
        {open ? <X size={24} aria-hidden /> : <MessageCircle size={24} aria-hidden />}
        {!open && total > 0 && <span className="figure absolute -right-1 -top-1 min-w-5 rounded-full border-2 border-bg bg-danger px-1 text-center text-[11px] font-bold leading-4 text-white">{total > 99 ? "99+" : total}</span>}
      </button>
      {info !== null && <InfoDialog messageId={info} onClose={() => setInfo(null)} />}
      {profile && <ProfileDialog userId={profile.id} hex={profile.hex} isAdmin={isAdmin} onClose={() => setProfile(null)} onPurged={() => void poll(true)} />}
    </>
  );
}
