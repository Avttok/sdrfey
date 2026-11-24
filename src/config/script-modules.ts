import type { ScriptNode } from "@/config/scripts";

/**
 * Módulos de roteiro: pedaços de conversa que se encaixam (abertura, perfil, descoberta, cada objeção, visita…).
 * Um roteiro é uma sequência de módulos ligados entre si; durante a ligação o sistema sugere qual módulo da
 * galeria encaixa melhor no momento, e aprende com as ligações guardadas. Puro, sem banco: o navegador também usa.
 */
export type ModuleCategory = "abertura" | "perfil" | "descoberta" | "pitch" | "proposta" | "fechamento" | "cadastro" | "objecao" | "relacionamento" | "retomada" | "visita" | "final";
export type ModuleDef = { key: string; title: string; category: ModuleCategory; hint: string; /** ids de passo que pertencem ao módulo */ match: RegExp; /** passo de entrada, em ordem de preferência */ entry: string[]; /** aparece nas sugestões durante a ligação */ suggest: boolean };

export const CATEGORY_LABEL: Record<ModuleCategory, string> = { abertura: "Abertura", perfil: "Quem decide", descoberta: "Descoberta", pitch: "Apresentação", proposta: "Proposta", fechamento: "Fechamento", cadastro: "Cadastro", objecao: "Objeção", relacionamento: "Relacionamento", retomada: "Retomada", visita: "Visita", final: "Final" };

const M = (key: string, title: string, category: ModuleCategory, hint: string, match: RegExp, entry: string[], suggest = true): ModuleDef => ({ key, title, category, hint, match, entry, suggest });

export const MODULES: ModuleDef[] = [
  M("entrada", "Abertura e recepção", "abertura", "Abrir a ligação, passar pela recepção, caixa postal e WhatsApp", /^(abertura|secretaria|assunto|gk_quem|horario|rec_email|transferido|quem|sem_resp|wa_msg|pedir_decisor)$/, ["abertura"], false),
  M("perfil", "Quem cuida das compras", "perfil", "Descobrir o papel do contato e levar até quem decide", /^(papel|p_[a-z]+)$/, ["papel"]),
  M("confirma", "Confirmar o negócio", "descoberta", "Confirmar empresa, segmento e como compram", /^conf_(empresa|segmento|negocio)$/, ["conf_empresa", "conf_segmento", "conf_negocio"]),
  M("pitch", "Apresentar a Fey", "pitch", "Contar o que a Fey faz e o ganho para o cliente", /^(pitch|impl|ganho|contrato)$/, ["pitch"]),
  M("descoberta", "Entender o que compram", "descoberta", "Perguntas sobre itens, aplicação, frequência e quando compram", /^(enr_[a-z]+|desc_itens|tabela)$/, ["enr_conhece", "desc_itens", "enr_aplicacao"]),
  M("minimo", "Pedido mínimo e desconto", "proposta", "Explicar o pedido mínimo e as condições", /^conf_minimo$/, ["conf_minimo"]),
  M("visita", "Propor a visita", "fechamento", "Convidar para a visita do representante e fechar dia e período", /^(visita|visita_confirma|digital)$/, ["visita"]),
  M("cadastro", "Confirmar o cadastro", "cadastro", "Atualizar quem compra, WhatsApp, e-mail e melhor horário", /^dados_[a-z]+$/, ["dados_abre"]),
  M("qualificacao", "Resumo da qualificação", "cadastro", "Fechar a qualificação com o que foi entendido", /^qualif_resumo$/, ["qualif_resumo"]),
  M("proposta", "Proposta e fechamento", "proposta", "Montar a proposta e fechar o pedido", /^(proposta|proposta_fecha|fechar|venda_extra)$/, ["proposta", "proposta_fecha", "fechar"]),
  M("duvidas", "Dúvidas da cotação", "relacionamento", "Tirar dúvidas, reenviar e combinar prazo", /^(duvidas|duvida_tec|reenviar|prazo|ret_ultima|motivo)$/, ["duvidas"]),
  M("fideliza", "Relacionamento", "relacionamento", "Nota de 0 a 10, dúvidas, reposição e indicação", /^fid_[a-z_]+$/, ["fid_continua", "fid_nps"]),
  M("reativa", "Retomar o contato", "retomada", "Histórico, motivo da parada e oferta de volta", /^reat_[a-z]+$/, ["reat_historico"]),
  M("visita_v", "Confirmar a visita", "visita", "Confirmar, lembrar, remarcar ou ligar depois da visita", /^v_[a-z]+$/, ["v_confirma", "v_pos"], false),
  M("spin", "Descoberta com SPIN", "descoberta", "Quatro perguntas: como compram, o que dá errado, o que isso custa e o que mudaria", /^gx_spin_[a-z]$/, ["gx_spin_s"]),
  M("segmento", "Conversa do segmento", "descoberta", "Duas perguntas feitas sob medida para o jeito de comprar deste segmento", /^gx_seg$/, ["gx_seg"]),
  M("concorda", "Concordar critérios", "descoberta", "Duas perguntas de concordância antes de apresentar a solução", /^gx_conc$/, ["gx_conc"]),
  M("prova", "Quem já compra da Fey", "pitch", "Prova social com o tipo de cliente que a Fey já atende", /^gx_prova$/, ["gx_prova"]),
  M("custo", "Custo de ficar parado", "proposta", "Comparar o preço da peça com o custo de parar por falta dela", /^gx_custo$/, ["gx_custo"]),
  M("util", "Oferecer algo útil", "pitch", "Mandar uma lista de itens de giro, sem compromisso, antes de pedir", /^gx_util$/, ["gx_util"]),
  M("proximo", "Fechar o próximo passo", "fechamento", "Combinar dia e período de uma conversa curta e esperar a resposta", /^gx_prox$/, ["gx_prox"]),
  M("ciclo", "Ciclo de reposição", "relacionamento", "Saber o ritmo de reposição e combinar o lembrete", /^gx_ciclo$/, ["gx_ciclo"]),
  M("cadencia", "Cadência de WhatsApp", "relacionamento", "Os cinco toques de WhatsApp, cada um com um assunto", /^gx_cad[0-9]?$/, ["gx_cad"]),
  M("despedida", "Mensagem de despedida", "retomada", "Despedir-se com elegância de quem não responde", /^gx_desp(_[a-z])?$/, ["gx_desp"]),
  M("menu_objecao", "Menu de objeções", "objecao", "Escolher a objeção que o lead levantou", /^obj_menu[0-9]?$/, ["obj_menu"], false),
  M("final", "Final da ligação", "final", "Resultado e próximos passos", /^fim_[a-z_]+$/, [], false),
];

const OBJ_TITLE: Record<string, string> = {
  preco: "Está caro", valor: "Não vê valor", prazo: "Prazo de entrega", qualidade: "Dúvida de qualidade", pagamento: "Forma de pagamento", frete: "Frete", minimo: "Pedido mínimo", minimo2: "Mínimo do 2º pedido",
  fornecedor: "Já tem fornecedor", satisfeito: "Satisfeito com o atual", distribuidor: "Compra de distribuidor", concorrente: "Concorrente", confianca: "Não conhece a Fey", ruim: "Experiência ruim",
  socio: "Falar com o sócio", tempo: "Sem tempo", enviar: "Manda por e-mail", estoque: "Tem estoque", depois: "Liga depois", verba: "Sem verba", pensar_geral: "Vou pensar", pensar: "Vou pensar",
  preco_cedo: "Preço de cara", resultado: "Duvida que funcione", nao_preciso: "Diz que não precisa", numero: "Como conseguiram o número", momento: "Deixa para outro momento", desconto: "Pede mais desconto", marca: "Só trabalha com uma marca", matriz: "Compra pela matriz", cadastro: "Burocracia de cadastro", certificado: "Pede certificado", referencia: "Pede referências", especial: "Item sob medida", nao: "Não quer",
};
export const objKey = (id: string) => `obj:${id.replace(/^obj_/, "")}`;

/** Módulo de um passo (pelo id, sem o prefixo de módulo injetado). */
export function moduleOf(nodeId: string): ModuleDef | { key: string; title: string; category: ModuleCategory; hint: string; match: RegExp; entry: string[]; suggest: boolean } | null {
  const id = nodeId.replace(/^g\d*:/, "");
  if (/^obj_/.test(id) && !/^obj_menu/.test(id)) { const k = id.replace(/^obj_/, ""); return { key: objKey(id), title: OBJ_TITLE[k] ?? k, category: "objecao", hint: "Resposta a esta objeção", match: new RegExp(`^${id}$`), entry: [id], suggest: true }; }
  return MODULES.find((m) => m.match.test(id)) ?? null;
}
export const baseId = (id: string) => id.replace(/^g\d*:/, "");

export type FlowStep = { key: string; title: string; category: ModuleCategory; nodes: number; entry: string };
/** A sequência de módulos do roteiro: a ordem em que aparecem a partir da abertura e as ligações entre eles. */
export function flowOf(nodes: ScriptNode[], startId: string): { modules: FlowStep[]; links: { from: string; to: string }[] } {
  const by = new Map(nodes.map((n) => [n.id, n])); const seen = new Set<string>([startId]); const order: string[] = []; const q = [startId];
  while (q.length) { const id = q.shift()!; order.push(id); for (const o of by.get(id)?.options ?? []) for (const t of [o.to, ...Object.values(o.goto ?? {})]) if (t && by.has(t) && !seen.has(t)) { seen.add(t); q.push(t); } }
  const mods = new Map<string, FlowStep>(); const links = new Set<string>();
  for (const id of order) { const m = moduleOf(id); if (!m || m.category === "objecao") continue; const cur = mods.get(m.key); if (cur) cur.nodes++; else mods.set(m.key, { key: m.key, title: m.title, category: m.category, nodes: 1, entry: id }); }
  for (const id of order) { const a = moduleOf(id); if (!a || a.category === "objecao") continue; for (const o of by.get(id)?.options ?? []) for (const t of [o.to, ...Object.values(o.goto ?? {})]) { const b = t ? moduleOf(t) : null; if (b && b.key !== a.key && b.category !== "objecao") links.add(`${a.key}>${b.key}`); } }
  return { modules: [...mods.values()], links: [...links].map((l) => { const [from, to] = l.split(">"); return { from, to }; }) };
}

/** Passos de um módulo dentro de um roteiro (os que o classificador reconhece). */
export function nodesOfModule(nodes: ScriptNode[], key: string): ScriptNode[] { return nodes.filter((n) => moduleOf(n.id)?.key === key); }
export function entryOf(nodes: ScriptNode[], key: string): string | null {
  const own = nodesOfModule(nodes, key); if (!own.length) return null; const m = moduleOf(own[0].id)!;
  return m.entry.find((e) => own.some((n) => n.id === e)) ?? own[0].id;
}

/** Copia um módulo para dentro de outro roteiro: ids com prefixo; o que sai do módulo volta ao ponto de onde se saiu ("§voltar"). Finais ligados ao módulo vêm junto. */
export function extractModule(nodes: ScriptNode[], key: string, prefix: string): { nodes: ScriptNode[]; entry: string } | null {
  const own = nodesOfModule(nodes, key); const entry = entryOf(nodes, key); if (!own.length || !entry) return null;
  const by = new Map(nodes.map((n) => [n.id, n])); const keep = new Set(own.map((n) => n.id));
  for (const n of own) for (const o of n.options) for (const t of [o.to, ...Object.values(o.goto ?? {})]) { const x = t ? by.get(t) : null; if (x && x.type === "fim") keep.add(x.id); }
  const re = (t: string | null) => (t && keep.has(t) ? prefix + t : t ? "§voltar" : t);
  return { entry: prefix + entry, nodes: nodes.filter((n) => keep.has(n.id)).map((n) => ({ ...n, id: prefix + n.id, options: n.options.map((o) => ({ ...o, to: re(o.to), ...(o.goto ? { goto: Object.fromEntries(Object.entries(o.goto).map(([k, v]) => [k, re(v) ?? "§voltar"])) } : {}) })) })) };
}

/** Chave do módulo pelo título mostrado ("Sugestão: Está caro" volta a obj:preco). */
export function keyByTitle(title: string): string | null {
  const m = MODULES.find((x) => x.title === title); if (m) return m.key;
  const o = Object.entries(OBJ_TITLE).find(([, v]) => v === title); return o ? `obj:${o[0]}` : null;
}
