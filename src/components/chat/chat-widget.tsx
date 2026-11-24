"use client";

import { BannerRain } from "@/components/banner-rain";
import { bannerStyle } from "@/config/banners";
import { lsGet, lsSet } from "@/lib/use-cached";
import { HScroll } from "@/components/h-scroll";
import { EggBadge } from "@/components/egg-badge";
import { AvatarGlyph } from "@/components/avatar-glyph";
import { CountUp } from "@/components/goal-tiles";

import { ACHIEVEMENT_BY_KEY } from "@/config/achievements";
import { chatStyle } from "@/components/chat/styled";
import { ChatShop } from "@/components/chat/chat-shop";
import { Plus, Coins, Building2, EllipsisVertical, ExternalLink, FileText, Handshake, Loader2, MessageCircle, Paperclip, Search, Send, SmilePlus, Trash2, WifiOff, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { RoleBadge } from "@/components/role-badge";
import { REACTION_EMOJIS, dmKey } from "@/modules/chat/channels";
import type { DmItem } from "@/modules/chat/data";
import type { ChatMsg, Reaction } from "@/modules/chat/data";
import { adminChatPurgeAction, chatPeopleAction, chatProfileAction, type ChatPerson, deleteChatMessageAction, searchShareAction, sendChatMessageAction, sharedInfoAction, toggleReactionAction, type ChatProfile } from "@/modules/chat/actions";
import type { ShareInfo, ShareItem, ShareKind } from "@/modules/chat/share";

import { useConfirm } from "@/components/confirm-dialog";
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
  const th = p?.theme;
  const themeVars = (th ? { "--accent": th.hex, "--accent-2": th.hex2 ?? `color-mix(in oklab, ${th.hex} 78%, black)`, "--on-accent": th.on } : { "--accent": hex }) as unknown as React.CSSProperties;
  const sty = chatStyle(p?.style);
  return (
    <div className="spawn-fade fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Perfil" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={themeVars} className="spawn-in relative w-full max-w-sm overflow-hidden rounded-3xl border border-line bg-panel shadow-2xl">
        <div className="relative h-32 overflow-hidden bg-grad" style={bannerStyle(p?.banner)}>
          <span aria-hidden className="sh-card absolute -left-6 -top-8 size-32 rounded-full bg-white/25 blur-2xl" style={{ "--d": "0s" } as React.CSSProperties} />
          <span aria-hidden className="sh-card absolute -bottom-10 right-2 size-40 rounded-full bg-black/20 blur-2xl" style={{ "--d": "-1.8s" } as React.CSSProperties} />
          <span aria-hidden className="pf-shine absolute inset-0" />
          {p && <BannerRain avatar={p.avatar} roles={p.roles} />}
          <span aria-hidden className="sh-card absolute right-16 top-5 size-3 rounded-full bg-white/70" style={{ "--d": "-.6s" } as React.CSSProperties} />
          <span aria-hidden className="sh-card absolute left-24 top-12 size-2 rounded-full bg-white/60" style={{ "--d": "-2.4s" } as React.CSSProperties} />
          <button type="button" aria-label="Fechar" className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-black/25 text-white backdrop-blur transition hover:bg-black/40" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="-mt-14 px-5 pb-5">
          <div className="sh-rise relative mx-auto grid size-28 place-items-center" style={{ "--d": ".05s" } as React.CSSProperties}>
            <span aria-hidden className="pf-ring absolute inset-0 rounded-full" />
            <span aria-hidden className="absolute inset-[4px] rounded-full bg-panel" />
            <span className="pf-avatar relative flex size-[5.5rem] items-center justify-center rounded-full bg-grad text-[1.9rem] font-bold leading-none tracking-tight text-on-accent shadow-lg"><span className="block translate-y-px">{p ? <AvatarGlyph avatar={p.avatar} initials={initials(p.name)} size={40} /> : "…"}</span></span>
          </div>
          <div className="sh-rise mt-3 text-center" style={{ "--d": ".12s" } as React.CSSProperties}>
            <h2 className={`display break-words text-2xl ${sty.nameCls}`} style={p ? sty.name : undefined}>{p?.name ?? "Carregando…"}</h2>
            {p && <p className="text-sm text-muted">@{p.username}</p>}
          </div>
          {err && <p className="mt-3 text-sm text-danger">{err}</p>}
          {p && (
            <div className="mt-4 space-y-4">
              <div className="sh-rise flex flex-wrap justify-center gap-1.5" style={{ "--d": ".18s" } as React.CSSProperties}>{p.roles.map((r) => <RoleBadge key={r} role={r} />)}</div>
              {p.egg && <div className="sh-rise egg-card flex items-center gap-3 rounded-2xl border border-amber-400/60 px-4 py-3" style={{ "--d": ".2s" } as React.CSSProperties}><EggBadge size={40} /><div className="min-w-0"><p className="text-sm font-extrabold">Douradovo</p><p className="text-xs text-muted">Encontrou o segredo escondido no sistema.</p></div></div>}
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {[["Mensagens", String(p.sent)], ["Conquistas", `${p.badges.length}/${p.badgeTotal}`], ...(p.isAdminView ? [["Conta", p.active ? "Ativa" : "Bloqueada"], ["Último acesso", p.lastLoginAt ? dtFmt.format(new Date(p.lastLoginAt)) : "nunca"]] : [])].map(([t, v], i) => (
                  <div key={t} className="sh-rise rounded-2xl bg-sunk px-3 py-2.5" style={{ "--d": `${0.22 + i * 0.06}s` } as React.CSSProperties}><dt className="text-[11px] text-muted">{t}</dt><dd className="figure text-base font-bold">{/^\d+$/.test(v) ? <CountUp to={Number(v)} /> : v}</dd></div>
                ))}
              </dl>
              <div className="sh-rise" style={{ "--d": ".4s" } as React.CSSProperties}>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted"><span>Conquistas</span><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunk"><span className="sh-fill block h-full rounded-full bg-grad" style={{ "--w": `${p.badgeTotal ? (p.badges.length / p.badgeTotal) * 100 : 0}%`, borderRight: 0 } as React.CSSProperties} /></span></div>
                {p.badges.length === 0 ? <p className="rounded-xl bg-sunk px-3 py-2.5 text-sm text-muted">Nenhuma conquista liberada ainda.</p> : (
                  <ul className="flex max-h-32 flex-wrap gap-2 overflow-y-auto p-1">
                    {p.badges.map((b, i) => { const a = ACHIEVEMENT_BY_KEY.get(b.key); if (!a) return null; const I = a.icon; return <li key={b.key} title={`${b.name} — ${a.desc}`} className="sh-rise grid size-11 place-items-center rounded-full border-2 border-white/40 text-white shadow-md transition hover:-translate-y-1 hover:scale-110" style={{ background: a.color, "--d": `${0.45 + i * 0.05}s` } as React.CSSProperties}><I size={19} aria-hidden /><span className="sr-only">{b.name}</span></li>; })}
                  </ul>
                )}
              </div>
              {isAdmin && (confirm
                ? <div className="flex flex-wrap items-center gap-2 rounded-xl border border-danger/50 bg-danger/5 p-3 text-sm"><span className="flex-1 font-medium text-danger">Apagar todas as mensagens de {p.name.split(" ")[0]}?</span><button type="button" className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white" onClick={purge}>Apagar</button><button type="button" className="rounded-lg px-3 py-1.5 text-xs hover:bg-sunk" onClick={() => setConfirm(false)}>Cancelar</button></div>
                : <button type="button" className="flex items-center gap-1.5 text-sm font-medium text-danger hover:underline" onClick={() => setConfirm(true)}><Trash2 size={14} aria-hidden /> Apagar todas as mensagens desta pessoa</button>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChatWidget({ channels, meId, isAdmin, initialUnread, myName = "" }: { myName?: string; channels: Channel[]; meId: number; isAdmin: boolean; initialUnread: Record<string, number> }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const { ask, dialog } = useConfirm();
  const [channel, setChannel] = useState(channels[0].key);
  useEffect(() => { const on = (e: Event) => { const c = (e as CustomEvent<string>).detail; if (typeof c === "string") { setChannel(c); setOpen(true); } }; window.addEventListener("fey:open-chat", on); return () => window.removeEventListener("fey:open-chat", on); }, []);
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
  const [shop, setShop] = useState(false);
  const [dms, setDms] = useState<DmItem[]>([]);
  const [people, setPeople] = useState<ChatPerson[]>([]);
  const [dmPick, setDmPick] = useState(false);
  const [dmQ, setDmQ] = useState("");
  const allChannels: Channel[] = [...channels, ...dms.map((d) => ({ key: d.key, label: d.name.split(" ")[0], hint: "Conversa direta" }))];
  useEffect(() => { const c = lsGet<ChatPerson[]>(`people:${meId}`); if (c) setPeople(c); }, [meId]);
  useEffect(() => { if (open) void chatPeopleAction().then((r) => { if (r.ok) { setPeople(r.people); lsSet(`people:${meId}`, r.people); } }).catch(() => {}); }, [open, meId]);
  const startDm = (p: ChatPerson) => { const key = dmKey(meId, p.id); setDms((cur) => (cur.some((d) => d.key === key) ? cur : [...cur, { key, withId: p.id, name: p.name, username: p.username, hex: p.hex }])); setChannel(key); setDmPick(false); setDmQ(""); setShop(false); };
  const [confirmClear, setConfirmClear] = useState(false);
  // área realmente visível (teclado aberto, barras do navegador): o chat nunca passa dela
  const [vv, setVv] = useState<{ h: number; inset: number } | null>(null);
  useEffect(() => {
    const v = window.visualViewport;
    if (!v) return;
    const f = () => setVv({ h: v.height, inset: Math.max(0, window.innerHeight - (v.offsetTop + v.height)) });
    f();
    v.addEventListener("resize", f); v.addEventListener("scroll", f); window.addEventListener("resize", f);
    return () => { v.removeEventListener("resize", f); v.removeEventListener("scroll", f); window.removeEventListener("resize", f); };
  }, []);
  const btnBottom = (vv?.inset ?? 0) + 20;
  const panelStyle = vv ? { bottom: btnBottom, height: Math.max(220, Math.min(704, vv.h - 40)) } : undefined;
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const fails = useRef(0);
  const busy = useRef(false);
  const tick = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const msgsRef = useRef(msgs);
  msgsRef.current = msgs;
  const chRef = useRef(channel);
  chRef.current = channel;
  /** Mensagens já carregadas de cada grupo: ao reabrir o chat elas aparecem na hora e só o que é novo é buscado. */
  const cacheRef = useRef<Record<string, { msgs: ChatMsg[]; more: boolean }>>({});
  const justOpened = useRef(false);
  const lsKey = `sdrfey:chat:${meId}`;
  const [restored, setRestored] = useState(false);

  // ao abrir o site: recupera o que ficou salvo (aberto/fechado, grupo, mensagens) e já busca as mensagens, sem marcar como lidas
  useEffect(() => {
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const j = JSON.parse(raw) as { open?: boolean; channel?: string; cache?: Record<string, { msgs: ChatMsg[]; more: boolean }> };
        if (j.cache) for (const [k, v] of Object.entries(j.cache)) if ((channels.some((c) => c.key === k) || k.startsWith("dm:")) && Array.isArray(v?.msgs)) cacheRef.current[k] = v;
        if (j.channel && (channels.some((c) => c.key === j.channel) || j.channel.startsWith("dm:"))) setChannel(j.channel);
        if (j.open) { justOpened.current = true; setOpen(true); }
      }
    } catch { /* sem armazenamento: segue sem salvar */ }
    setRestored(true);
    for (const c of channels) {
      void fetch(`/api/chat?channel=${encodeURIComponent(c.key)}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { messages?: ChatMsg[] } | null) => {
          if (!j?.messages || cacheRef.current[c.key]) return;
          cacheRef.current[c.key] = { msgs: j.messages, more: j.messages.length >= 40 };
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {
      const cache: Record<string, { msgs: ChatMsg[]; more: boolean }> = {};
      for (const [k, v] of Object.entries(cacheRef.current)) cache[k] = { msgs: v.msgs.slice(-40), more: v.more };
      localStorage.setItem(lsKey, JSON.stringify({ open, channel, cache }));
    } catch { /* cheio ou bloqueado */ }
  }, [restored, open, channel, msgs, lsKey]);

  /** Uma consulta ao servidor. Nunca roda duas ao mesmo tempo; falhas viram aviso "sem conexão" e novas tentativas. */
  const poll = useCallback(async (reset = false): Promise<void> => {
    if (busy.current && !reset) return;
    busy.current = true;
    const ch = chRef.current;
    const cur = reset ? [] : msgsRef.current;
    const last = cur.length ? cur[cur.length - 1].id : 0;
    const u = new URLSearchParams();
    if (open) { u.set("channel", ch); u.set("open", "1"); if (justOpened.current) { u.set("mark", "1"); justOpened.current = false; } if (last) { u.set("after", String(last)); if (tick.current++ % 2 === 0) u.set("from", String(cur[0].id)); } }
    try {
      const r = await fetch(`/api/chat?${u}`, { cache: "no-store" });
      if (r.status === 401) { fails.current = 99; setOffline(true); return; }
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { dms?: DmItem[]; mentions?: { id: number; by: string; channel: string; preview: string }[]; enabled: boolean; unread: Record<string, number>; messages: ChatMsg[]; gone: number[]; reactions: Record<number, Reaction[]> };
      fails.current = 0; setOffline(false);
      if (!j.enabled) { setOff(true); return; }
      if (j.dms) setDms((cur) => [...j.dms!, ...cur.filter((c) => !j.dms!.some((d) => d.key === c.key))]);
      setUnread(open ? { ...j.unread, [ch]: 0 } : j.unread);
      if (!open || chRef.current !== ch) return;
      if (reset) { setMsgs(j.messages); setMore(j.messages.length >= 40); setLoaded(true); }
      else if (j.messages.length >= 40) { setMsgs(j.messages); setMore(true); } // ficou muito tempo fora: recomeça do fim
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
  useEffect(() => {
    if (!open) return;
    stick.current = true;
    const c = cacheRef.current[channel];
    justOpened.current = true;
    if (c) { msgsRef.current = c.msgs; tick.current = 0; setMsgs(c.msgs); setMore(c.more); setLoaded(true); void poll(false); }
    else { setLoaded(false); setMsgs([]); msgsRef.current = []; void poll(true); }
  }, [open, channel, poll]);
  useEffect(() => { if (loaded && msgs.every((m) => m.channel === channel)) cacheRef.current[channel] = { msgs, more }; }, [msgs, more, loaded, channel]);
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
        {first ? <button type="button" disabled={!m.userId} onClick={() => m.userId && setProfile({ id: m.userId, hex: m.hex })} aria-label={`Perfil de ${m.name}`} className="grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white transition hover:scale-110" style={{ background: m.hex }} title={m.name}><AvatarGlyph avatar={m.avatar} initials={initials(m.name)} size={15} /></button> : <span className="size-7 shrink-0" />}
        <div className={`flex min-w-0 max-w-[85%] flex-col ${mine ? "items-end" : "items-start"}`}>
          {first && <p className={`mb-0.5 flex flex-wrap items-center gap-1.5 px-1 text-[11px] text-muted ${mine ? "justify-end" : ""}`}><button type="button" disabled={!m.userId} onClick={() => m.userId && setProfile({ id: m.userId, hex: m.hex })} className={`font-medium hover:underline ${chatStyle(m.style).nameCls}`} style={chatStyle(m.style).name}>{mine ? "Você" : m.name.split(" ")[0]}</button><span className="text-[10px] font-normal opacity-70">{hm.format(new Date(m.at))}</span></p>}
          <div className="min-w-0 max-w-full">
            <div title={hm.format(new Date(m.at))} style={chatStyle(m.style).bubble ?? undefined} className={`min-w-0 max-w-full rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm ${mine ? "rounded-br-md" : "rounded-bl-md"} ${chatStyle(m.style).bubble ? "" : mine ? "bg-grad text-on-accent" : "bg-panel ring-1 ring-line"}`}>
              {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
              {m.share && S && (
                <button type="button" onClick={() => setInfo(m.id)} className={`${m.body ? "mt-2" : ""} flex w-full min-w-0 items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${mine ? "border-white/30 bg-white/15 hover:bg-white/25" : "border-line bg-sunk hover:border-accent/50"}`}>
                  <S.Icon size={18} aria-hidden className="shrink-0" />
                  <span className="min-w-0"><span className="block text-[11px] opacity-75">{S.label}</span><span className="block truncate text-sm font-semibold">{m.share.label}</span></span>
                </button>
              )}
            </div>
            <div className={`mt-0.5 flex items-center gap-0.5 px-0.5 ${mine ? "justify-end" : ""}`}>
              <button type="button" aria-label="Reagir" title="Reagir" aria-expanded={pickFor === m.id} onClick={() => setPickFor(pickFor === m.id ? null : m.id)} className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] transition hover:bg-sunk hover:text-accent ${pickFor === m.id ? "bg-sunk text-accent" : "text-muted"}`}><SmilePlus size={13} aria-hidden /> Reagir</button>
              {m.canDelete && (m.delUntil === null || Date.now() < m.delUntil) && <button type="button" aria-label="Apagar mensagem" title="Apagar" onClick={() => ask({ title: "Apagar esta mensagem?", body: "Ela some para todos no chat.", label: "Sim, apagar", icon: Trash2, onConfirm: () => void del(m.id) })} className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] text-muted transition hover:bg-danger/10 hover:text-danger"><Trash2 size={13} aria-hidden /> Apagar</button>}
            </div>
            {pickFor === m.id && <div role="group" aria-label="Escolha uma reação" className={`mt-1 inline-flex max-w-full flex-wrap gap-0.5 rounded-2xl border border-line bg-panel p-1 shadow-md`}>{REACTION_EMOJIS.map((e) => <button key={e} type="button" onClick={() => { react(m.id, e); setPickFor(null); }} className="rounded-full px-1.5 py-0.5 text-lg transition hover:scale-125 hover:bg-sunk" aria-label={`Reagir com ${e}`}>{e}</button>)}</div>}
          </div>
          {m.reactions.length > 0 && <div className={`mt-1 flex flex-wrap gap-1 ${mine ? "justify-end" : ""}`}>{m.reactions.map((x) => <button key={x.emoji} type="button" onClick={() => react(m.id, x.emoji)} title={x.names.join(", ")} aria-label={`${x.emoji} ${x.count}`} aria-pressed={x.mine} className={`figure rounded-full border px-1.5 py-0.5 text-xs transition ${x.mine ? "border-accent bg-accent/15" : "border-line bg-panel hover:border-accent/50"}`}>{x.emoji} {x.count}</button>)}</div>}
        </div>
      </div>,
    );
  }
  const cur = allChannels.find((c) => c.key === channel) ?? (channel.startsWith("dm:") ? { key: channel, label: "Conversa", hint: "Conversa direta" } : undefined);
  return (
    <>
      {open && (
        <section aria-label="Chat" style={panelStyle} className="card-in pointer-events-auto fixed inset-x-3 bottom-5 z-40 flex h-[min(44rem,calc(100dvh-2.5rem))] flex-col overflow-hidden rounded-[1.75rem] border border-line bg-panel shadow-2xl sm:inset-x-auto sm:right-5 sm:w-[min(28rem,calc(100vw-2.5rem))]">
          <header className="flex items-center gap-2.5 bg-grad-soft px-4 py-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-grad text-on-accent shadow-md"><MessageCircle size={20} aria-hidden /></span>
            <div className="min-w-0 flex-1"><h2 className="display text-base leading-tight">{shop ? "Loja do chat" : channel.startsWith("dm:") ? `Conversa com ${dms.find((d) => d.key === channel)?.name ?? "…"}` : `Chat · ${cur?.label}`}</h2><p className="truncate text-[11px] text-muted">{shop ? "Gaste suas moedas no seu estilo" : channel.startsWith("dm:") ? "Conversa direta" : cur?.hint}</p></div>
            <button type="button" aria-label="Loja de moedas" aria-pressed={shop} title="Loja" className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${shop ? "bg-grad text-on-accent" : "text-muted hover:bg-sunk hover:text-ink"}`} onClick={() => setShop((v) => !v)}><Coins size={15} aria-hidden /> Loja</button>
            {isAdmin && (
              <div className="relative">
                <button type="button" aria-label="Opções do Adm" aria-expanded={menu} className="rounded-lg p-1.5 text-muted hover:bg-sunk" onClick={() => { setMenu(!menu); setConfirmClear(false); }}><EllipsisVertical size={17} /></button>
                {menu && (
                  <div role="menu" className="absolute right-0 top-9 z-20 w-60 space-y-1 rounded-xl border border-line bg-panel p-2 text-sm shadow-xl">
                    <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Controle do Adm</p>
                    {confirmClear
                      ? <div className="space-y-2 rounded-lg border border-danger/50 bg-danger/5 p-2"><p className="text-xs font-medium text-danger">Apagar TODAS as mensagens do grupo {cur?.label}? Não dá para desfazer.</p><div className="flex gap-2"><button type="button" className="rounded-lg bg-danger px-2.5 py-1 text-xs font-semibold text-white" onClick={clearChannel}>Sim, apagar</button><button type="button" className="rounded-lg px-2.5 py-1 text-xs hover:bg-sunk" onClick={() => setConfirmClear(false)}>Cancelar</button></div></div>
                      : <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-danger hover:bg-sunk" onClick={() => setConfirmClear(true)}><Trash2 size={14} aria-hidden /> Limpar o grupo {cur?.label}</button>}
                    <p className="px-2 text-[11px] text-muted">Para apagar uma mensagem use o botão Apagar logo abaixo dela (até 15 minutos depois de enviar; o Adm apaga sempre). Para apagar tudo de uma pessoa, abra o perfil dela.</p>
                  </div>
                )}
              </div>
            )}
            <button type="button" aria-label="Fechar chat" className="grid size-9 place-items-center rounded-xl text-muted transition hover:bg-panel hover:text-ink" onClick={() => setOpen(false)}><X size={18} /></button>
          </header>
          {offline && <p role="status" className="flex items-center gap-2 bg-warn/15 px-4 py-1.5 text-xs font-medium text-warn"><WifiOff size={13} aria-hidden /> Sem conexão com o servidor. Tentando de novo…</p>}
          {shop && <ChatShop myName={myName} meId={meId} />}
          {!shop && (
            <div className="relative">
              <HScroll role="tablist" label="Grupos e conversas" className="flex items-center gap-1.5 border-b border-line/70 px-3 py-2.5">
                {allChannels.map((c) => (
                  <button key={c.key} type="button" role="tab" aria-selected={channel === c.key} onClick={() => setChannel(c.key)} className={`relative shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${channel === c.key ? "bg-grad text-on-accent shadow-sm" : "bg-sunk text-muted hover:bg-accent/10 hover:text-ink"}`}>
                    {c.key.startsWith("dm:") && <span aria-hidden className="mr-1 inline-block size-1.5 rounded-full" style={{ background: dms.find((d) => d.key === c.key)?.hex }} />}{c.label}{unread[c.key] ? <span className="figure ml-1.5 rounded-full bg-danger px-1.5 text-[10px] font-bold leading-4 text-white">{unread[c.key]}</span> : null}
                  </button>
                ))}
                <button type="button" aria-label="Nova conversa direta" title="Nova conversa direta" aria-expanded={dmPick} onClick={() => setDmPick((v) => !v)} className="ml-auto grid size-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-sunk hover:text-accent"><Plus size={16} aria-hidden /></button>
              </HScroll>
              {dmPick && (
                <div className="absolute inset-x-2 top-full z-20 mt-1 rounded-xl border border-line bg-panel p-2 shadow-xl">
                  <input autoFocus value={dmQ} onChange={(e) => setDmQ(e.target.value)} placeholder="Conversar com…" className="mb-1.5 w-full rounded-lg border border-line bg-sunk px-3 py-2 text-sm" />
                  <ul className="max-h-48 overflow-y-auto">
                    {people.filter((p) => !dmQ || `${p.name} ${p.username}`.toLowerCase().includes(dmQ.toLowerCase())).map((p) => (
                      <li key={p.id}><button type="button" onClick={() => startDm(p)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-sunk"><span aria-hidden className="size-2.5 rounded-full" style={{ background: p.hex }} /><span className="flex-1 truncate">{p.name}</span><span className="text-xs text-muted">@{p.username}</span></button></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {!shop && <div ref={scroller} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }} className="min-h-0 flex-1 overflow-y-auto bg-sunk/40 px-4 py-4">
            {!loaded && <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted"><Loader2 size={15} className="animate-spin" aria-hidden /> Carregando…</p>}
            {loaded && more && <button type="button" onClick={loadOlder} className="mx-auto mb-2 block rounded-lg px-3 py-1 text-xs text-muted hover:bg-sunk">Ver mensagens anteriores</button>}
            {loaded && msgs.length === 0 && <p className="py-10 text-center text-sm text-muted">Nenhuma mensagem ainda. Comece a conversa!</p>}
            {rows}
          </div>}
          {!shop && <footer className="relative border-t border-line/70 bg-panel p-3">
            {picker && <SharePicker onClose={() => setPicker(false)} onPick={(p) => { setPicked(p); setPicker(false); }} />}
            {picked && (() => { const K = KIND_META[picked.kind]; return <div className="mb-2 flex items-center gap-2 rounded-xl bg-sunk px-3 py-1.5 text-xs"><K.Icon size={14} aria-hidden className="shrink-0 text-accent" /><span className="min-w-0 flex-1 truncate"><b>{K.label}:</b> {picked.label}</span><button type="button" aria-label="Remover anexo" onClick={() => setPicked(null)} className="rounded p-0.5 hover:bg-line"><X size={13} /></button></div>; })()}
            <div className="flex items-end gap-1.5">
              <button type="button" aria-label="Compartilhar lead, negociação ou cotação" title="Compartilhar" onClick={() => setPicker(true)} className="grid size-10 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-sunk hover:text-accent"><Paperclip size={18} aria-hidden /></button>
              <textarea value={draft} rows={1} maxLength={2000} placeholder={channel.startsWith("dm:") ? "Mensagem direta…" : "Escreva uma mensagem…"} aria-label="Mensagem" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl bg-sunk px-4 py-3 text-sm outline-none ring-0 transition placeholder:text-muted/70 focus:bg-sunk focus:ring-2 focus:ring-accent/30" />
              <button type="button" aria-label="Enviar" disabled={sending || (!draft.trim() && !picked)} onClick={send} className="grid size-11 shrink-0 place-items-center rounded-2xl bg-grad text-on-accent shadow-md transition hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:shadow-none">{sending ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <Send size={17} aria-hidden />}</button>
            </div>
          </footer>}
        </section>
      )}
      {!open &&       <button type="button" aria-label={open ? "Fechar chat" : total ? `Abrir chat (${total} não lidas)` : "Abrir chat"} aria-expanded={open} onClick={() => setOpen(!open)} className="pointer-events-auto relative grid size-14 place-items-center rounded-full bg-grad text-on-accent shadow-xl transition hover:scale-105 active:scale-95">
        <MessageCircle size={24} aria-hidden />
        {total > 0 && <span className="figure absolute -right-1 -top-1 min-w-5 rounded-full border-2 border-bg bg-danger px-1 text-center text-[11px] font-bold leading-4 text-white">{total > 99 ? "99+" : total}</span>}
      </button>}
      {dialog}
      {info !== null && <InfoDialog messageId={info} onClose={() => setInfo(null)} />}
      {profile && <ProfileDialog userId={profile.id} hex={profile.hex} isAdmin={isAdmin} onClose={() => setProfile(null)} onPurged={() => void poll(true)} />}
    </>
  );
}
