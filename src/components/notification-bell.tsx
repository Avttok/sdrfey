"use client";

import { Bell, BellRing, CheckCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { NOTIF_META, type NotifView } from "@/config/notifications";
import { clearNotificationsAction, markNotificationsAction } from "@/modules/notifications/actions";

const ago = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 1 ? "agora" : m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h` : `${Math.floor(m / 1440)} d`; };

/** Sino ao lado da foto: concentra menções, repasses, metas, conquistas e avisos da pessoa. */
export function NotificationBell({ side = false }: { side?: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<NotifView[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [ring, setRing] = useState(false);
  const last = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { items: NotifView[]; unread: number };
      setItems(d.items); setUnread(d.unread);
      if (d.unread > last.current && last.current >= 0) { setRing(true); setTimeout(() => setRing(false), 2500); }
      last.current = d.unread;
    } catch { /* sem rede */ }
  }, []);
  useEffect(() => {
    last.current = -1; void load();
    const t = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 30_000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const go = (n: NotifView) => { setOpen(false); if (!n.read) { setItems((l) => l.map((x) => (x.id === n.id ? { ...x, read: true } : x))); setUnread((u) => Math.max(0, u - 1)); void markNotificationsAction([n.id]); } if (n.href) router.push(n.href); };
  const all = () => { setItems((l) => l.map((x) => ({ ...x, read: true }))); setUnread(0); last.current = 0; void markNotificationsAction("all"); };
  const clear = () => { setItems((l) => l.filter((x) => !x.read)); void clearNotificationsAction(); };

  return (
    <div ref={box} className="relative">
      <button type="button" aria-label={unread ? `Notificações (${unread} novas)` : "Notificações"} aria-expanded={open} onClick={() => { setOpen(!open); if (!open) void load(); }} className="relative grid size-10 place-items-center rounded-xl text-muted transition hover:bg-sunk hover:text-ink">
        {unread > 0 ? <BellRing size={20} aria-hidden className={ring ? "bell-ring text-accent" : "text-accent"} /> : <Bell size={20} aria-hidden />}
        {unread > 0 && <span className="figure absolute -right-0.5 -top-0.5 grid min-w-[1.1rem] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-[1.1rem] text-white shadow">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Notificações" className={`menu-up fixed z-50 w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-2xl card-edge card-surface shadow-2xl ${side ? "bottom-16 left-2" : "right-2 top-16"}`}>
          <header className="flex items-center gap-2 border-b border-line px-3 py-2.5"><p className="flex-1 text-sm font-semibold">Notificações</p>
            <button type="button" onClick={all} disabled={!unread} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-sunk hover:text-ink disabled:opacity-40"><CheckCheck size={14} aria-hidden /> Marcar lidas</button>
            <button type="button" onClick={clear} aria-label="Limpar lidas" className="grid size-7 place-items-center rounded-lg text-muted transition hover:bg-sunk hover:text-danger"><Trash2 size={14} aria-hidden /></button>
          </header>
          <ul className="max-h-[26rem] divide-y divide-line/60 overflow-y-auto">
            {items.map((n) => { const m = NOTIF_META[n.kind] ?? NOTIF_META.sistema; const Icon = m.icon; return (
              <li key={n.id}><button type="button" onClick={() => go(n)} className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-sunk ${n.read ? "opacity-65" : ""}`}>
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl text-white" style={{ background: m.color }}><Icon size={15} aria-hidden /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium leading-snug">{n.title}</span>{n.body && <span className="block truncate text-xs text-muted">{n.body}</span>}<span className="text-[11px] text-muted">{m.label} · {ago(n.at)}</span></span>
                {!n.read && <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-accent" />}
              </button></li>); })}
            {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted"><Bell size={26} aria-hidden className="mx-auto mb-2 opacity-40" />Tudo em dia por aqui.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
