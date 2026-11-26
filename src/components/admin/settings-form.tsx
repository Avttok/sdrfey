"use client";

import { Portal } from "@/components/portal";
import { Clock, Database, Sparkles, LayoutDashboard, ShieldCheck, MessageCircle, PanelTop, Shuffle } from "lucide-react";
import { useState } from "react";
import { MorphMark } from "@/components/logo-morph";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { saveSettingsAction } from "@/modules/admin/config";
import type { SettingKey } from "@/modules/settings/get";

type Field = { key: SettingKey; label: string; hint: string; unit?: string; kind?: "number" | "toggle" | "period" | "choice"; min?: number; options?: [number, string][] };

const GROUPS: { title: string; sub: string; icon: typeof Clock; fields: Field[] }[] = [
  { title: "Regras do sorteio", sub: "Quando um lead volta ou some do sorteio", icon: Shuffle, fields: [
    { key: "lock_minutes", label: "Liberar lead parado", hint: "Sem atividade por esse tempo, o lead volta ao sorteio.", unit: "minutos" },
    { key: "skip_hours", label: "Lead pulado fica escondido", hint: "Só some para quem pulou.", unit: "horas" },
    { key: "sem_contato_days", label: "“Sem contato” volta ao sorteio", hint: "Dias corridos.", unit: "dias" },
    { key: "rework_days", label: "Lead já trabalhado volta ao sorteio", hint: "Quando nenhuma situação define outro prazo. Dias corridos.", unit: "dias" },
  ] },
  { title: "Dashboard", sub: "Alertas e período padrão", icon: LayoutDashboard, fields: [
    { key: "alert_days", label: "Lead quente ou visita parada vira alerta", hint: "Aparece no bloco Alertas do dashboard.", unit: "dias", min: 1 },
    { key: "dash_default_days", label: "Período que o dashboard abre", hint: "Cada pessoa ainda pode trocar o filtro.", kind: "period" },
  ] },
  { title: "Fila dos vendedores", sub: "Como os leads qualificados chegam aos vendedores", icon: Shuffle, fields: [
    { key: "seller_queue_on", label: "Distribuir em fila (1, 2, 3, 4, 1…)", hint: "Ligado: o lead encaminhado pelo SDR vai para o próximo vendedor da vez. Desligado: cai no grupo e o primeiro a assumir fica com ele.", kind: "toggle" },
  ] },
  { title: "Negociações", sub: "Avisos do kanban de vendas e prazos", icon: LayoutDashboard, fields: [
    { key: "deal_new_untouched_hours", label: "Negociação nova sem contato vira alerta", hint: "Depois desse tempo sem ninguém mexer.", unit: "horas", min: 1 },
    { key: "deal_pool_hours", label: "Negociação no pool sem dono vira alerta", hint: "Esperando um vendedor assumir.", unit: "horas", min: 1 },
    { key: "deal_quote_chase_days", label: "Cobrar cotação enviada após", hint: "Sem resposta do cliente.", unit: "dias", min: 1 },
    { key: "deal_stale_days", label: "Negociação parada vira alerta", hint: "Sem nenhum andamento.", unit: "dias", min: 1 },
    { key: "deal_followup_days", label: "Retorno padrão após enviar cotação", hint: "Prazo sugerido para o próximo contato.", unit: "dias", min: 1 },
  ] },
  { title: "Consulta de CNPJ e arquivos", sub: "Reenvio automático e limites de upload", icon: Shuffle, fields: [
    { key: "enrich_retry_hours", label: "Tentar de novo um CNPJ sem resposta", hint: "Espera antes de repetir a consulta.", unit: "horas", min: 1 },
    { key: "import_max_mb", label: "Tamanho máximo de planilha", hint: "CSV ou XLSX de importação.", unit: "MB", min: 1 },
    { key: "import_max_rows", label: "Linhas que acendem o aviso de arquivo grande", hint: "Só avisa, não bloqueia.", unit: "linhas", min: 100 },
    { key: "pdf_max_mb", label: "Tamanho máximo de PDF", hint: "Cotações e pedidos.", unit: "MB", min: 1 },
    { key: "email_img_px", label: "Imagem de e-mail: largura máxima", hint: "Imagens maiores são reduzidas a essa largura (mais pixels = mais nítida).", unit: "px", min: 200 },
    { key: "email_img_kb", label: "Imagem de e-mail: peso máximo de cada uma", hint: "A qualidade baixa só o necessário para caber.", unit: "KB", min: 50 },
    { key: "email_html_kb", label: "Modelo de e-mail: peso máximo total", hint: "Texto + todas as imagens do modelo.", unit: "KB", min: 100 },
  ] },
  { title: "Identidade visual", sub: "Logo animada no sistema inteiro", icon: Sparkles, fields: [
    { key: "logo_anim", label: "Animação da logo", hint: "Como a marca alterna entre FEY e SDR no cabeçalho, no menu e no login.", kind: "choice", options: [[1, "Morph (peças se transformam)"], [2, "Onda (peças em onda)"], [0, "Desligada (marca FEY + SDR)"]] },
    { key: "logo_pace", label: "Ritmo", hint: "Velocidade da troca e tempo que cada logo fica à vista.", kind: "choice", options: [[0, "Calmo"], [1, "Normal"], [2, "Ágil"]] },
    { key: "logo_text", label: "Mostrar o texto “SDR” ao lado", hint: "Com a animação ligada o SDR já aparece na própria marca; ligue para repetir o nome em texto.", kind: "toggle" },
  ] },
  { title: "Menu", sub: "Como as abas aparecem", icon: PanelTop, fields: [
    { key: "nav_group", label: "Abas em menus agrupados", hint: "Pessoas, Info, SDR, Gestão. Desligado, aparecem todas soltas.", kind: "toggle" },
  ] },
  { title: "Comunicação", sub: "Chat interno", icon: MessageCircle, fields: [
    { key: "chat_on", label: "Chat interno", hint: "Botão flutuante. Desligado, some para todos (as conversas ficam guardadas).", kind: "toggle" },
  ] },
  { title: "Fontes da consulta de CNPJ", sub: "De onde vêm telefones, e-mails e dados", icon: Database, fields: [
    { key: "enrich_fast", label: "Pesquisa Rápida", hint: "Modo em massa: ~10 leads ao mesmo tempo. Dados da Receita vêm da BrasilAPI ou da Minha Receita (alternando, sem limite), e-mail e telefone vêm do OpenCNPJ, e o site de cada lead é lido em seguida. A ReceitaWS só pega, 1 por vez, quem ficou sem nenhum contato.", kind: "toggle" },
    { key: "enrich_receitaws", label: "ReceitaWS", hint: "Dados cadastrais e telefones da Receita. Gratuita, com limite de consultas por minuto.", kind: "toggle" },
    { key: "enrich_brasilapi", label: "BrasilAPI", hint: "Mesma base da Receita, sem o limite apertado. Gratuita.", kind: "toggle" },
    { key: "enrich_minhareceita", label: "Minha Receita (reserva)", hint: "Só entra quando as duas de cima não respondem. Gratuita.", kind: "toggle" },
    { key: "enrich_places", label: "Google Places (Maps)", hint: "Acha telefone e site que só estão no Maps. É paga e precisa da chave GOOGLE_PLACES_API_KEY nas variáveis da Vercel. Sem a chave, fica sem efeito.", kind: "toggle" },
    { key: "enrich_site", label: "Site do estabelecimento", hint: "Quando o lead tem site, lê a página inicial e a de contato e guarda telefones, e-mails, WhatsApp e Instagram. Gratuita; deixa a consulta um pouco mais lenta.", kind: "toggle" },
  ] },
  { title: "Segurança", sub: "Proteção dos dados", icon: ShieldCheck, fields: [
    { key: "copy_guard", label: "Bloquear cópia de telas", hint: "Para quem não é Adm: impede selecionar, copiar, arrastar e clicar com o botão direito (campos de texto continuam normais).", kind: "toggle" },
    { key: "update_notice", label: "Avisar sobre atualização do site", hint: "Quando sair uma versão nova, quem está com a página aberta numa versão velha vê “Por favor, recarregue a página. Há uma nova atualização!”.", kind: "toggle" },
  ] },
];

export function SettingsForm({ initial }: { initial: Record<SettingKey, number> }) {
  const [v, setV] = useState(initial);
  const { run, pending } = useRun();
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  const set = (k: SettingKey, n: number) => setV({ ...v, [k]: n });
  return (
    <form className="space-y-4 pb-20" onSubmit={(e) => { e.preventDefault(); run(() => saveSettingsAction(v)); }}>
      <div className="grid gap-4 xl:grid-cols-2">
        {GROUPS.map((g) => (
          <section key={g.title} className={`${panelCls} overflow-hidden ${g.fields.length > 2 ? "xl:row-span-2" : ""}`}>
            <header className="flex items-center gap-3 border-b border-line bg-sunk/60 px-4 py-3">
              <span className="grid size-9 place-items-center rounded-xl bg-grad-soft text-accent"><g.icon size={18} aria-hidden /></span>
              <div><h2 className="text-sm font-semibold">{g.title}</h2><p className="text-xs text-muted">{g.sub}</p></div>
            </header>
            <ul className="divide-y divide-line/60">
              {g.fields.map((f) => (
                <li key={f.key} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3.5">
                  <label htmlFor={`p-${f.key}`} className="min-w-52 flex-1 text-sm"><span className="block font-medium">{f.label}</span><span className="mt-0.5 block text-xs text-muted">{f.hint}</span></label>
                  {f.kind === "toggle" ? (
                    <button type="button" id={`p-${f.key}`} role="switch" aria-checked={v[f.key] === 1} aria-label={f.label} onClick={() => set(f.key, v[f.key] === 1 ? 0 : 1)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${v[f.key] === 1 ? "bg-grad" : "border border-line bg-sunk"}`}><span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${v[f.key] === 1 ? "left-[1.45rem]" : "left-0.5"}`} /></button>
                  ) : f.kind === "choice" ? (
                    <select id={`p-${f.key}`} className={`${inputCls} !w-64`} value={v[f.key]} onChange={(e) => set(f.key, Number(e.target.value))}>{f.options!.map(([n, l]) => <option key={n} value={n}>{l}</option>)}</select>
                  ) : f.kind === "period" ? (
                    <select id={`p-${f.key}`} className={`${inputCls} !w-36`} value={v[f.key]} onChange={(e) => set(f.key, Number(e.target.value))}><option value={1}>Hoje</option><option value={7}>7 dias</option><option value={30}>30 dias</option></select>
                  ) : (
                    <span className="flex items-center gap-2"><input id={`p-${f.key}`} type="number" min={f.min ?? 0} className={`${inputCls} !w-24 text-center`} value={v[f.key]} onChange={(e) => set(f.key, Number(e.target.value))} /><span className="w-14 text-xs text-muted">{f.unit}</span></span>
                  )}
                </li>
              ))}
            </ul>
            {g.title === "Identidade visual" && <div className="flex items-center gap-4 border-t border-line bg-sunk/40 px-4 py-4"><MorphMark size={72} anim={v.logo_anim} pace={v.logo_pace} /><p className="text-xs text-muted">Prévia: é assim que a logo aparece para a equipe.</p></div>}
          </section>
        ))}
      </div>
      {dirty && (
        <Portal><div role="status" className="fixed inset-x-0 bottom-5 z-30 mx-auto flex w-[min(34rem,calc(100%-2rem))] items-center gap-3 rounded-2xl border border-accent bg-panel p-3 pl-4 shadow-2xl">
          <span className="flex-1 text-sm font-medium">Alterações ainda não salvas</span>
          <button type="button" className={btnGhost} disabled={pending} onClick={() => setV(initial)}>Descartar</button>
          <button type="submit" disabled={pending} className={btnPrimary}>Salvar parâmetros</button>
        </div></Portal>
      )}
    </form>
  );
}
