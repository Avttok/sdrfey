"use client";

import { Bold, Eraser, ImagePlus, Italic, Link2, Underline } from "lucide-react";
import { useEffect, useRef } from "react";
import { useToast } from "@/components/toast";
import { inputCls } from "@/components/ui";
import { sanitizeHtml, TEMPLATE_VARIABLES } from "@/modules/email/render";

const FONTS = ["Arial", "Georgia", "Verdana", "Tahoma", "Trebuchet MS", "Times New Roman", "Courier New"];
const SIZES: [string, string][] = [["1", "Pequeno"], ["3", "Normal"], ["4", "Médio"], ["5", "Grande"], ["6", "Muito grande"]];

/** Reduz qualquer imagem (arquivo ou data URL) para no máximo 520 px de largura e ~120 KB. Fundo branco; JPEG leve. */
async function shrinkSrc(src: string): Promise<string> {
  const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  let width = Math.min(520, img.width);
  for (let quality = 0.82; ; quality -= 0.12) {
    const k = width / img.width;
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const out = c.toDataURL("image/jpeg", Math.max(quality, 0.4));
    if (out.length < 160_000 || (quality <= 0.4 && width <= 240)) return out;
    if (quality <= 0.4) { width = Math.round(width * 0.75); quality = 0.94; }
  }
}
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try { return await shrinkSrc(url); } finally { URL.revokeObjectURL(url); }
}

export function RichEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const toast = useToast();
  useEffect(() => { if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = sanitizeHtml(value); /* só ao montar / trocar de modelo */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const emit = () => onChange(ref.current?.innerHTML ?? "");
  /** Colar ou soltar imagem: reduz antes de entrar no modelo (evita o erro de "muito grande"). */
  const addFiles = async (files: File[]) => {
    for (const f of files) {
      try { ref.current?.focus(); document.execCommand("insertImage", false, await shrink(f)); } catch { toast("warn", "Não consegui ler essa imagem."); }
    }
    emit();
  };
  /** Imagens que vieram embutidas num texto colado (copiadas de uma página, por exemplo) também são reduzidas. */
  const lighten = () => {
    const root = ref.current; if (!root) return;
    root.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src") ?? "";
      if (src.startsWith("data:") && src.length > 160_000) void shrinkSrc(src).then((out) => { img.setAttribute("src", out); emit(); }).catch(() => {});
    });
  };
  const cmd = (c: string, v?: string) => { ref.current?.focus(); document.execCommand(c, false, v); emit(); };
  const btn = "grid size-8 place-items-center rounded-md border border-line bg-panel text-ink hover:bg-sunk";
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-sunk p-2">
        <button type="button" className={btn} aria-label="Negrito" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("bold")}><Bold size={15} /></button>
        <button type="button" className={btn} aria-label="Itálico" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("italic")}><Italic size={15} /></button>
        <button type="button" className={btn} aria-label="Sublinhado" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("underline")}><Underline size={15} /></button>
        <select className={`${inputCls} !w-auto !py-1 text-xs`} aria-label="Fonte" defaultValue="" onChange={(e) => { if (e.target.value) cmd("fontName", e.target.value); e.target.value = ""; }}>
          <option value="">Fonte</option>{FONTS.map((f) => <option key={f}>{f}</option>)}
        </select>
        <select className={`${inputCls} !w-auto !py-1 text-xs`} aria-label="Tamanho" defaultValue="" onChange={(e) => { if (e.target.value) cmd("fontSize", e.target.value); e.target.value = ""; }}>
          <option value="">Tamanho</option>{SIZES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-muted">Cor <input type="color" aria-label="Cor do texto" className="size-8 cursor-pointer rounded border border-line bg-transparent" onChange={(e) => cmd("foreColor", e.target.value)} /></label>
        <button type="button" className={btn} aria-label="Link" onMouseDown={(e) => e.preventDefault()} onClick={() => { const u = prompt("Endereço do link (https://…)"); if (u && /^(https?:|mailto:)/i.test(u)) cmd("createLink", u); }}><Link2 size={15} /></button>
        <button type="button" className={btn} aria-label="Imagem" title="Inserir imagem (do computador ou por endereço)" onMouseDown={(e) => e.preventDefault()} onClick={() => {
          const u = prompt("Endereço (https://…) da imagem. Deixe vazio para escolher um arquivo do computador.");
          if (u && /^https:\/\//i.test(u)) cmd("insertImage", u); else if (u === "") file.current?.click();
        }}><ImagePlus size={15} /></button>
        <button type="button" className={btn} aria-label="Limpar formatação" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("removeFormat")}><Eraser size={15} /></button>
        <select className={`${inputCls} !w-auto !py-1 text-xs`} aria-label="Inserir variável" defaultValue="" onChange={(e) => { if (e.target.value) cmd("insertText", `{${e.target.value}}`); e.target.value = ""; }}>
          <option value="">+ Variável</option>{TEMPLATE_VARIABLES.map((v) => <option key={v} value={v}>{`{${v}}`}</option>)}
        </select>
        <input ref={file} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
          try { const d = await shrink(f); if (d.length > 400_000) toast("warn", "Imagem pesada demais. Escolha uma menor."); else cmd("insertImage", d); } catch { toast("warn", "Não consegui ler essa imagem."); }
        }} />
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning onInput={emit} onBlur={emit}
        onPaste={(e) => { const imgs = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/")); if (imgs.length) { e.preventDefault(); void addFiles(imgs); } else setTimeout(lighten, 0); }}
        onDrop={(e) => { const imgs = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/")); if (imgs.length) { e.preventDefault(); void addFiles(imgs); } }} className="min-h-44 p-3 text-sm leading-relaxed outline-none [&_a]:text-accent [&_a]:underline [&_img]:max-w-full" />
    </div>
  );
}
