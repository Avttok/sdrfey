"use client";

import { useBusyWhile } from "@/components/toast";
import { Check, Lock, Eye, EyeOff, Image as ImageIcon, Loader2, Moon, Palette, Sun, UserRound, KeyRound, Smile } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { BannerRain } from "@/components/banner-rain";
import { BannerGrid } from "@/components/banner-grid";
import { bannerStyle } from "@/config/banners";
import { AvatarGlyph } from "@/components/avatar-glyph";
import { RoleBadge } from "@/components/role-badge";
import { inputCls, labelCls } from "@/components/ui";
import { AVATARS } from "@/config/avatars";
import { unlockHint } from "@/components/rarity-tag";
import type { Role } from "@/config/roles";
import { CHOOSABLE_ACCENTS, resolveAccent, swatchBg } from "@/config/theme";
import { completeProfileAction, firstAccessAction } from "@/modules/auth/actions";

const initialsOf = (n: string) => n.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

function Step({ n, icon: Icon, title, hint, children }: { n: number; icon: typeof Palette; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="sh-rise rounded-3xl border border-line bg-panel p-5 shadow-sm" style={{ "--d": `${0.08 * n}s` } as React.CSSProperties}>
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-grad text-on-accent shadow"><Icon size={18} aria-hidden /></span>
        <div><h2 className="display text-lg leading-tight">{title}</h2>{hint && <p className="text-xs text-muted">{hint}</p>}</div>
      </div>
      {children}
    </section>
  );
}

/** Primeiro acesso: nome, ícone, cor, tema e senha numa tela só, com uma prévia ao vivo. */
export function FirstAccessForm({ name: name0, username, roles, accent: accent0, needPassword = true }: { name: string; username: string; roles: Role[]; accent: string | null; needPassword?: boolean }) {
  const [name, setName] = useState(name0);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [accent, setAccent] = useState<string | null>(accent0);
  const [banner, setBanner] = useState<string | null>(null);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [cur, setCur] = useState(""); const [next, setNext] = useState(""); const [conf, setConf] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  useBusyWhile(pending);
  useEffect(() => { try { if (localStorage.getItem("theme") === "dark") setMode("dark"); } catch {} }, []);
  const pickMode = (m: "light" | "dark") => { setMode(m); document.documentElement.classList.toggle("dark", m === "dark"); try { localStorage.setItem("theme", m); } catch {} };
  const ac = resolveAccent(accent, roles);
  const vars = { "--accent": ac.hex, "--accent-2": ac.hex2 ?? `color-mix(in oklab, ${ac.hex} 78%, black)`, "--on-accent": ac.onAccent } as unknown as React.CSSProperties;
  const mismatch = conf.length > 0 && next !== conf;
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    start(async () => {
      // Insiste até 10 vezes se a conexão falhar; só para antes quando o servidor responde (erro de validação ou sucesso).
      for (let i = 0; i < 10; i++) {
        try {
          const r = needPassword ? await firstAccessAction({ current: cur, next, confirm: conf, name, avatar, accent, banner }) : await completeProfileAction({ name, avatar, accent, banner });
          if (r?.ok || (i > 0 && r?.error === "Este acesso já foi concluído.")) { window.location.assign("/painel"); return; }
          if (r?.error) { setErr(r.error); return; }
        } catch { /* conexão caiu: tenta de novo */ }
        await new Promise((res) => setTimeout(res, 500 + i * 300));
      }
      setErr("Não consegui salvar agora. Confira a conexão e tente de novo.");
    });
  };
  const pw = show ? "text" : "password";
  return (
    <form onSubmit={submit} style={vars} className="space-y-4">
      {/* prévia */}
      <div className="sticky top-2 z-30"><div className="sh-rise relative overflow-hidden rounded-3xl bg-grad p-5 text-on-accent shadow-xl" style={bannerStyle(banner)}>
        <span aria-hidden className="sh-card absolute -right-8 -top-10 size-36 rounded-full bg-white/25 blur-2xl" style={{ "--d": "0s" } as React.CSSProperties} />
        <span aria-hidden className="sh-card absolute -bottom-12 left-10 size-32 rounded-full bg-black/20 blur-2xl" style={{ "--d": "-2s" } as React.CSSProperties} />
        <BannerRain avatar={avatar} roles={roles} />
        <div className="relative flex items-center gap-4">
          <span className="relative grid size-20 shrink-0 place-items-center">
            <span aria-hidden className="pf-ring absolute inset-0 rounded-full" />
            <span aria-hidden className="absolute inset-[3px] rounded-full bg-black/35" />
            <span className="relative flex size-[4.25rem] items-center justify-center rounded-full bg-white/15 text-2xl font-bold leading-none backdrop-blur-sm"><AvatarGlyph avatar={avatar} initials={initialsOf(name) || "?"} size={32} /></span>
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium opacity-80">Bem-vindo(a) ao SDR FEY</p>
            <p className="display truncate text-2xl leading-tight">{name.trim().split(" ")[0] || "—"}</p>
            <p className="truncate text-xs opacity-75">@{username}</p>
          </div>
        </div>
        <div className="relative mt-3 flex flex-wrap gap-1.5">{roles.map((r) => <RoleBadge key={r} role={r} />)}</div>
      </div>
      </div>

      <Step n={1} icon={UserRound} title="Seu nome" hint="Como a equipe vai ver você. O login (@usuário) não muda.">
        <label htmlFor="fa-name" className={labelCls}>Nome de exibição</label>
        <input id="fa-name" className={inputCls} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
      </Step>

      <Step n={2} icon={Smile} title="Seu ícone" hint="Escolha um bichinho. Os com cadeado você libera com conquistas, e ficam disponíveis em Minha conta.">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Ícone de perfil">
          <button type="button" role="radio" aria-checked={!avatar} title="Iniciais do nome" onClick={() => setAvatar(null)} className={`grid size-12 place-items-center rounded-2xl border-2 text-sm font-bold transition ${!avatar ? "border-accent bg-grad text-on-accent" : "border-line bg-sunk text-muted hover:text-ink"}`}>{initialsOf(name) || "?"}</button>
          {AVATARS.map((a) => {
            const locked = !!a.unlock; // quem acabou de chegar ainda não tem conquistas
            return (
              <button key={a.key} type="button" role="radio" aria-checked={avatar === a.key} aria-disabled={locked} disabled={locked} title={locked ? `${a.label} · ${unlockHint(a.unlock!)}` : a.label} onClick={() => setAvatar(a.key)} className={`relative grid size-12 place-items-center rounded-2xl border-2 transition ${locked ? "cursor-not-allowed opacity-50" : "hover:-translate-y-0.5"} ${avatar === a.key ? "border-accent bg-grad text-on-accent shadow-md" : "border-line bg-sunk text-muted hover:text-ink"}`}>
                <AvatarGlyph avatar={a.key} initials="" size={22} />
                {locked && <span className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full bg-panel text-muted ring-1 ring-line"><Lock size={9} aria-hidden /></span>}
              </button>
            );
          })}
        </div>
      </Step>

      <Step n={3} icon={ImageIcon} title="Banner do perfil" hint="Um padrão com a sua cor. A prévia lá em cima muda na hora. Os com cadeado saem de conquistas.">
        <BannerGrid value={banner} onPick={setBanner} />
      </Step>

      <Step n={4} icon={Palette} title="Cor e tema" hint="Dá para mudar depois em Minha conta.">
        <div className="flex flex-wrap gap-2.5">
          {CHOOSABLE_ACCENTS.map((a) => (
            <button key={a.key} type="button" title={a.label} aria-label={a.label} aria-pressed={accent === a.key} onClick={() => setAccent(a.key)} className="grid size-10 place-items-center rounded-full ring-offset-2 ring-offset-panel transition hover:scale-105 aria-pressed:ring-2 aria-pressed:ring-ink" style={{ background: swatchBg(a), color: a.key === "lima" ? "#1a1a1a" : "#fff" }}>{accent === a.key && <Check size={17} aria-hidden />}</button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Tema" className="mt-4 inline-flex rounded-xl border border-line bg-sunk p-1">
          {([["light", "Claro", Sun], ["dark", "Noturno", Moon]] as const).map(([m, l, I]) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => pickMode(m)} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${mode === m ? "bg-grad text-on-accent shadow" : "text-muted hover:text-ink"}`}><I size={15} aria-hidden /> {l}</button>
          ))}
        </div>
      </Step>

      {needPassword && <Step n={5} icon={KeyRound} title="Sua senha" hint="A provisória serve só para entrar agora. Pelo menos 8 caracteres, com letras e números.">
        <div className="space-y-3">
          <div><label htmlFor="fa-cur" className={labelCls}>Senha provisória</label><input id="fa-cur" className={inputCls} type={pw} value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required /></div>
          <div><label htmlFor="fa-next" className={labelCls}>Nova senha</label><input id="fa-next" className={inputCls} type={pw} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} required /></div>
          <div><label htmlFor="fa-conf" className={labelCls}>Repita a nova senha</label><input id="fa-conf" className={`${inputCls} ${mismatch ? "!border-danger" : ""}`} type={pw} value={conf} onChange={(e) => setConf(e.target.value)} autoComplete="new-password" required />{mismatch && <p className="mt-1 text-sm text-danger">As senhas não são iguais.</p>}</div>
          <button type="button" onClick={() => setShow((v) => !v)} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">{show ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />} {show ? "Ocultar senhas" : "Mostrar senhas"}</button>
        </div>
      </Step>}

      {err && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{err}</p>}
      <button type="submit" disabled={pending} className="sh-go inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-grad text-lg font-bold text-on-accent shadow-lg transition disabled:opacity-60">
        {pending ? <><Loader2 size={20} className="animate-spin" aria-hidden /> Salvando…</> : needPassword ? "Salvar e entrar" : "Salvar e continuar"}
      </button>
    </form>
  );
}
